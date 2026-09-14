import { NextRequest, NextResponse } from "next/server";
import { verifyEasyPostSignature } from "@/lib/webhooks/verify";
import { parseEasyPostWebhook } from "@/lib/providers/parse";
import { ingestNormalizedWebhook } from "@/lib/providers/ingest";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const secret = process.env.EASYPOST_WEBHOOK_SECRET ?? "";
  const signature = req.headers.get("x-hmac-signature");

  if (secret) {
    const ok = verifyEasyPostSignature(rawBody, signature, secret);
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

  const normalized = parseEasyPostWebhook(payload);
  const result = await ingestNormalizedWebhook("easypost", normalized);
  return NextResponse.json({
    ok: result.accepted,
    duplicate: result.duplicate,
    trackingNumber: normalized.trackingNumber,
  });
}
