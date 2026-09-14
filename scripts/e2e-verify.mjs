/**
 * Live HTTP verification loop against a running Trackly server.
 * Usage: node scripts/e2e-verify.mjs [baseUrl]
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const secret = process.env.TRACKLY_DEMO_WEBHOOK_SECRET ?? "demo-webhook-secret";

function sign(body, timestamp) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

async function wait(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function getJson(path, init) {
  const res = await fetch(`${baseUrl}${path}`, init);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { res, json };
}

console.log(`E2E against ${baseUrl}`);

// Health: carriers endpoint
{
  const { res, json } = await getJson("/api/carriers");
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(json.carriers));
  assert.ok(json.providers.some((p) => p.id === "aftership"));
  console.log("✓ Carriers catalog");
}

// Reject bad demo signature
{
  const body = JSON.stringify({
    event_id: "bad_sig",
    tracking_number: "BADSIG1",
    carrier: "fedex",
    status: "in_transit",
    message: "nope",
    occurred_at: new Date().toISOString(),
  });
  const { res } = await getJson("/api/webhooks/demo", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Trackly-Signature": "deadbeef",
      "X-Trackly-Timestamp": Math.floor(Date.now() / 1000).toString(),
    },
    body,
  });
  assert.equal(res.status, 401);
  console.log("✓ Demo webhook rejects bad HMAC");
}

// Simulate full FedEx journey
{
  const { res, json } = await getJson("/api/demo/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ carrier: "fedex", stepDelayMs: 400 }),
  });
  assert.equal(res.status, 200);
  const tn = json.trackingNumber;
  assert.ok(tn);
  console.log(`✓ Simulation started ${tn}`);

  let status = "pending";
  let checkpoints = 0;
  for (let i = 0; i < 40; i++) {
    await wait(500);
    const snap = await getJson(`/api/track/${encodeURIComponent(tn)}`);
    if (snap.res.status !== 200) continue;
    status = snap.json.shipment.status;
    checkpoints = snap.json.shipment.checkpoints.length;
    process.stdout.write(
      `  … status=${status} checkpoints=${checkpoints}\r`,
    );
    if (status === "delivered" && checkpoints >= 5) break;
  }
  console.log("");
  assert.equal(status, "delivered");
  assert.ok(checkpoints >= 5, `expected >=5 checkpoints, got ${checkpoints}`);
  console.log("✓ FedEx journey reached delivered via webhooks");
}

// AfterShip-shaped webhook (unsigned in demo when secret unset)
{
  const tn = `AS${Date.now()}`;
  const payload = {
    event_id: `as_${tn}`,
    msg: {
      id: `trk_${tn}`,
      tracking_number: tn,
      slug: "ups",
      tag: "InTransit",
      checkpoints: [
        {
          checkpoint_time: "2026-09-14T09:00:00Z",
          message: "Origin Scan",
          tag: "InfoReceived",
          city: "Louisville",
          state: "KY",
          country_iso3: "USA",
        },
        {
          checkpoint_time: "2026-09-14T14:00:00Z",
          message: "In Transit",
          tag: "InTransit",
          city: "Denver",
          state: "CO",
          country_iso3: "USA",
        },
      ],
    },
  };
  const { res, json } = await getJson("/api/webhooks/aftership", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(res.status, 200);
  assert.equal(json.ok, true);

  // idempotent replay
  const replay = await getJson("/api/webhooks/aftership", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(replay.json.duplicate, true);

  const snap = await getJson(`/api/track/${encodeURIComponent(tn)}`);
  assert.equal(snap.res.status, 200);
  assert.equal(snap.json.shipment.status, "in_transit");
  assert.ok(snap.json.shipment.checkpoints.length >= 2);
  console.log("✓ AfterShip webhook normalize + idempotent replay");
}

// EasyPost-shaped webhook
{
  const tn = `EP${Date.now()}`;
  const payload = {
    id: `evt_${tn}`,
    description: "tracker.updated",
    result: {
      id: `trk_${tn}`,
      tracking_code: tn,
      status: "out_for_delivery",
      carrier: "DHLExpress",
      tracking_details: [
        {
          message: "With delivery courier",
          status: "out_for_delivery",
          datetime: "2026-09-14T15:00:00Z",
          tracking_location: {
            city: "New York",
            state: "NY",
            country: "US",
          },
        },
      ],
    },
  };
  const { res } = await getJson("/api/webhooks/easypost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert.equal(res.status, 200);
  const snap = await getJson(`/api/track/${encodeURIComponent(tn)}`);
  assert.equal(snap.json.shipment.status, "out_for_delivery");
  assert.equal(snap.json.shipment.carrier, "dhl");
  console.log("✓ EasyPost webhook normalize");
}

// Manual signed demo event
{
  const tn = `MAN${Date.now()}`;
  await getJson("/api/trackers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackingNumber: tn, carrier: "usps" }),
  });
  const payload = {
    event_id: `demo_${tn}`,
    tracking_number: tn,
    carrier: "usps",
    status: "delivered",
    message: "Delivered, In/At Mailbox",
    occurred_at: new Date().toISOString(),
    location: { city: "Chicago", region: "IL", country: "US" },
  };
  const body = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000).toString();
  const { res, json } = await getJson("/api/webhooks/demo", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Trackly-Signature": sign(body, ts),
      "X-Trackly-Timestamp": ts,
    },
    body,
  });
  assert.equal(res.status, 200);
  assert.equal(json.status, "delivered");
  console.log("✓ Signed demo webhook delivery");
}

console.log("\nE2E verification passed.\n");
