import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "fs";
import path from "path";
import { mergeStatus, isTerminal, type CanonicalStatus } from "../src/lib/status";
import {
  verifyAfterShipSignature,
  verifyEasyPostSignature,
  verifyDemoSignature,
  signOutbound,
} from "../src/lib/webhooks/verify";
import {
  parseAfterShipWebhook,
  parseEasyPostWebhook,
  parseDemoWebhook,
} from "../src/lib/providers/parse";
import { detectCarrier } from "../src/lib/carrier-detect";
import {
  claimWebhookEvent,
  createShipment,
  appendTrackingEvent,
  toSnapshot,
  getShipmentByTracking,
} from "../src/lib/db";

function section(name: string) {
  console.log(`\n✓ ${name}`);
}

// Status machine
{
  assert.equal(mergeStatus("pending", "label_created"), "label_created");
  assert.equal(mergeStatus("in_transit", "out_for_delivery"), "out_for_delivery");
  assert.equal(mergeStatus("delivered", "in_transit"), "delivered");
  assert.equal(mergeStatus("in_transit", "customs_hold"), "customs_hold");
  assert.equal(mergeStatus("out_for_delivery", "failed_attempt"), "failed_attempt");
  assert.ok(isTerminal("delivered"));
  assert.ok(!isTerminal("in_transit"));
  section("Status machine is monotonic and terminal-safe");
}

// Carrier detect
{
  assert.equal(detectCarrier("1Z999AA10123456784").carrier, "ups");
  assert.equal(detectCarrier("FDX12345678ABCD").carrier, "fedex");
  assert.equal(detectCarrier("DHL1234567").carrier, "dhl");
  section("Carrier auto-detect");
}

// Signatures
{
  const body = JSON.stringify({ hello: "world" });
  const afterSecret = "as-secret";
  const asSig = crypto
    .createHmac("sha256", afterSecret)
    .update(body)
    .digest("base64");
  assert.equal(verifyAfterShipSignature(body, asSig, afterSecret), true);
  assert.equal(verifyAfterShipSignature(body, "bad", afterSecret), false);

  const epSecret = "ep-secret";
  const epSig = crypto
    .createHmac("sha256", epSecret)
    .update(body)
    .digest("hex");
  assert.equal(verifyEasyPostSignature(body, epSig, epSecret), true);

  const ts = Math.floor(Date.now() / 1000).toString();
  const demoSecret = "demo-webhook-secret";
  const demoSig = signOutbound(body, ts, demoSecret);
  assert.equal(verifyDemoSignature(body, demoSig, ts, demoSecret), true);
  assert.equal(verifyDemoSignature(body, demoSig, "1", demoSecret), false);
  section("Webhook HMAC verification");
}

// Parsers
{
  const as = parseAfterShipWebhook({
    event_id: "evt_as_1",
    msg: {
      id: "trk_1",
      tracking_number: "FDXPARSE001",
      slug: "fedex",
      tag: "OutForDelivery",
      checkpoints: [
        {
          checkpoint_time: "2026-09-14T10:00:00Z",
          message: "On FedEx vehicle for delivery",
          tag: "OutForDelivery",
          city: "Austin",
          state: "TX",
          country_iso3: "USA",
        },
      ],
      expected_delivery: "2026-09-15",
    },
  });
  assert.equal(as.carrier, "fedex");
  assert.equal(as.events[0].status, "out_for_delivery");

  const ep = parseEasyPostWebhook({
    id: "evt_ep_1",
    result: {
      id: "trk_ep",
      tracking_code: "1Z999AA10123456784",
      status: "delivered",
      carrier: "UPS",
      tracking_details: [
        {
          message: "Delivered",
          status: "delivered",
          datetime: "2026-09-14T18:00:00Z",
          tracking_location: { city: "Seattle", state: "WA", country: "US" },
        },
      ],
    },
  });
  assert.equal(ep.carrier, "ups");
  assert.equal(ep.events[0].status, "delivered");

  const demo = parseDemoWebhook({
    event_id: "demo_1",
    tracking_number: "DHLTEST1",
    carrier: "dhl",
    status: "customs_hold",
    message: "Held for customs",
    occurred_at: "2026-09-14T12:00:00Z",
  });
  assert.equal(demo.events[0].status, "customs_hold");
  section("Provider payload normalization");
}

// DB ingest + idempotency
{
  // Use isolated temp db by setting cwd data — db path is process.cwd()/data
  const dataDir = path.join(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  // wipe test db if present from prior run by renaming unique - actually better-sqlite3
  // singleton may already be open. For unit test we just use unique tracking numbers.

  const tn = `UNIT${Date.now()}`;
  const shipment = createShipment({
    trackingNumber: tn,
    carrier: "fedex",
    provider: "demo",
  });

  const claimed1 = claimWebhookEvent(`unit_evt_${tn}`, "demo", { a: 1 });
  const claimed2 = claimWebhookEvent(`unit_evt_${tn}`, "demo", { a: 1 });
  assert.equal(claimed1, true);
  assert.equal(claimed2, false);

  const e1 = appendTrackingEvent(shipment.id, {
    eventId: `cp_${tn}_1`,
    occurredAt: "2026-09-14T08:00:00Z",
    status: "label_created" as CanonicalStatus,
    message: "Label created",
    source: "test",
  });
  assert.equal(e1.inserted, true);
  assert.equal(e1.shipment.status, "label_created");

  const e1dup = appendTrackingEvent(shipment.id, {
    eventId: `cp_${tn}_1`,
    occurredAt: "2026-09-14T08:00:00Z",
    status: "label_created" as CanonicalStatus,
    message: "Label created",
    source: "test",
  });
  assert.equal(e1dup.inserted, false);

  appendTrackingEvent(shipment.id, {
    eventId: `cp_${tn}_2`,
    occurredAt: "2026-09-14T12:00:00Z",
    status: "in_transit",
    message: "In transit",
    source: "test",
    location: { city: "Dallas", region: "TX", country: "US" },
  });
  appendTrackingEvent(shipment.id, {
    eventId: `cp_${tn}_3`,
    occurredAt: "2026-09-14T16:00:00Z",
    status: "delivered",
    message: "Delivered",
    source: "test",
  });
  // regress attempt
  const regress = appendTrackingEvent(shipment.id, {
    eventId: `cp_${tn}_4`,
    occurredAt: "2026-09-14T17:00:00Z",
    status: "in_transit",
    message: "Should not regress",
    source: "test",
  });
  assert.equal(regress.shipment.status, "delivered");

  const snap = toSnapshot(getShipmentByTracking(tn, "fedex")!);
  // History is append-only (incl. post-delivery noise); status stays locked.
  assert.equal(snap.checkpoints.length, 4);
  assert.equal(snap.status, "delivered");
  assert.ok(snap.actualDeliveryAt);
  section("SQLite ingest, idempotency, and status lock");
}

console.log("\nAll unit checks passed.\n");
