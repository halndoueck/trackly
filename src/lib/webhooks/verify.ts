import crypto from "crypto";

export function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** AfterShip: base64(HMAC-SHA256(rawBody, secret)) in header aftership-hmac-sha256 */
export function verifyAfterShipSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature || !secret) return false;
  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");
  return timingSafeEqualStr(digest, signature);
}

/** EasyPost: hex HMAC-SHA256 in X-Hmac-Signature */
export function verifyEasyPostSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature || !secret) return false;
  const digest = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");
  return timingSafeEqualStr(digest, signature);
}

/** Demo / outbound: HMAC-SHA256(timestamp.payload) hex */
export function signOutbound(
  payload: string,
  timestamp: string,
  secret: string,
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
}

export function verifyDemoSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  secret: string,
  maxSkewSec = 300,
): boolean {
  if (!signature || !timestamp || !secret) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const skew = Math.abs(Date.now() / 1000 - ts);
  if (skew > maxSkewSec) return false;
  const expected = signOutbound(rawBody, timestamp, secret);
  return timingSafeEqualStr(expected, signature);
}
