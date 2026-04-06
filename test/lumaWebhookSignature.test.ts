import { describe, test, expect } from "bun:test";
import { createHmac } from "node:crypto";
import { verifyLumaWebhookSignature, isWebhookTimestampFresh } from "../src/luma/verifyWebhookSignature.js";

describe("Luma webhook signature", () => {
  test("accepts valid HMAC per Luma docs", () => {
    const secret = "whsec_test_secret";
    const body = '{"type":"guest.updated","data":{}}';
    const t = "1700000000";
    const expected = createHmac("sha256", secret)
      .update(`${t}.${body}`)
      .digest("hex");
    const header = `t=${t},v1=${expected}`;
    expect(verifyLumaWebhookSignature(secret, header, body)).toBe(true);
  });

  test("rejects wrong body", () => {
    const secret = "whsec_test_secret";
    const body = '{"type":"guest.updated"}';
    const t = "1700000000";
    const expected = createHmac("sha256", secret)
      .update(`${t}.${body}`)
      .digest("hex");
    const header = `t=${t},v1=${expected}`;
    expect(verifyLumaWebhookSignature(secret, header, body + "x")).toBe(false);
  });
});

describe("Luma webhook timestamp", () => {
  test("accepts current time", () => {
    const now = Math.floor(Date.now() / 1000).toString();
    expect(isWebhookTimestampFresh(now, 300)).toBe(true);
  });

  test("rejects stale timestamp", () => {
    const old = (Math.floor(Date.now() / 1000) - 400).toString();
    expect(isWebhookTimestampFresh(old, 300)).toBe(false);
  });
});
