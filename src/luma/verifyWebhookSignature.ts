import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies Luma webhook signatures per https://help.lu.ma/p/webhooks
 */
export function verifyLumaWebhookSignature(
  secret: string,
  signatureHeader: string | undefined,
  rawBody: string
): boolean {
  if (!signatureHeader || !secret) {
    return false;
  }

  const parts: Record<string, string> = {};
  for (const part of signatureHeader.split(",")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    parts[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }

  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) {
    return false;
  }

  const signedPayload = `${t}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(signedPayload).digest("hex");

  try {
    const expectedBuf = Buffer.from(expected, "utf8");
    const actualBuf = Buffer.from(v1, "utf8");
    return (
      expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf)
    );
  } catch {
    return false;
  }
}

const WEBHOOK_MAX_AGE_SEC = 300;

export function isWebhookTimestampFresh(
  timestampHeader: string | undefined,
  maxAgeSec: number = WEBHOOK_MAX_AGE_SEC
): boolean {
  if (!timestampHeader) {
    return false;
  }
  const ts = Number.parseInt(timestampHeader, 10);
  if (!Number.isFinite(ts)) {
    return false;
  }
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - ts) <= maxAgeSec;
}
