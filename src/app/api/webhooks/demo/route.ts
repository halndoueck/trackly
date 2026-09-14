import { NextRequest, NextResponse } from "next/server";
import { verifyDemoSignature } from "@/lib/webhooks/verify";
import { parseDemoWebhook } from "@/lib/providers/parse";
import { ingestNormalizedWebhook } from "@/lib/providers/ingest";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const secret =
    process.env.TRACKLY_DEMO_WEBHOOK_SECRET ?? "demo-webhook-secret";
  const signature = req.headers.get("x-trackly-signature");
  const timestamp = req.headers.get("x-trackly-timestamp");

  const ok = verifyDemoSignature(rawBody, signature, timestamp, secret);
  if (!ok) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const normalized = parseDemoWebhook(payload);
  const result = await ingestNormalizedWebhook("demo", normalized);
  return NextResponse.json({
    ok: result.accepted,
    duplicate: result.duplicate,
    trackingNumber: normalized.trackingNumber,
    status: result.snapshot?.status ?? null,
  });
}
