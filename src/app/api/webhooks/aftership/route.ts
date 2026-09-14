import { NextRequest, NextResponse } from "next/server";
import { verifyAfterShipSignature } from "@/lib/webhooks/verify";
import { parseAfterShipWebhook } from "@/lib/providers/parse";
import { ingestNormalizedWebhook } from "@/lib/providers/ingest";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const secret = process.env.AFTERSHIP_WEBHOOK_SECRET ?? "";
  const signature = req.headers.get("aftership-hmac-sha256");

  // In production require secret; in demo allow unsigned when secret unset
  if (secret) {
    const ok = verifyAfterShipSignature(rawBody, signature, secret);
    if (!ok) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const normalized = parseAfterShipWebhook(payload);
  const result = await ingestNormalizedWebhook("aftership", normalized);
  return NextResponse.json({
    ok: result.accepted,
    duplicate: result.duplicate,
    trackingNumber: normalized.trackingNumber,
  });
}
