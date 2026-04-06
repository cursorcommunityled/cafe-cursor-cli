#!/usr/bin/env bun
/**
 * HTTP server for Luma webhooks: on guest.updated, verify check-in via Luma API
 * and email a Cursor credit (Resend). See https://docs.luma.com/reference/getting-started-with-your-api
 *
 * Env:
 *   LUMA_API_KEY       - x-luma-api-key (Luma Plus)
 *   LUMA_WEBHOOK_SECRET - whsec_... from Luma webhook settings
 *   RESEND_API_KEY, RESEND_FROM_EMAIL - required to actually send email
 *   LUMA_DATA_PATH     - optional; directory for cafe_*.csv and dedupe file (default: cwd)
 */

import { sendCursorCreditToGuest } from "./services/sendCursorCreditEmail.js";
import { fetchLumaGuest, guestHasCheckedIn } from "./luma/lumaClient.js";
import {
  verifyLumaWebhookSignature,
  isWebhookTimestampFresh,
} from "./luma/verifyWebhookSignature.js";
import * as localStorage from "./utils/localStorage.js";

function extractGuestPayload(body: unknown): {
  eventId: string;
  guestId: string;
  email: string;
  firstName: string;
  lastName: string;
} | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const root = body as Record<string, unknown>;
  const type = typeof root.type === "string" ? root.type : "";
  if (type && type !== "guest.updated") {
    return null;
  }

  const data = root.data;
  if (!data || typeof data !== "object") {
    return null;
  }
  const d = data as Record<string, unknown>;

  const guestObj =
    d.guest && typeof d.guest === "object" ? (d.guest as Record<string, unknown>) : d;

  const eventId =
    (typeof d.event_id === "string" && d.event_id) ||
    (typeof root.event_id === "string" && root.event_id) ||
    "";

  const guestId =
    (typeof guestObj.id === "string" && guestObj.id) ||
    (typeof d.api_id === "string" && d.api_id) ||
    (typeof d.guest_api_id === "string" && d.guest_api_id) ||
    (typeof root.api_id === "string" && root.api_id) ||
    "";

  const email =
    (typeof guestObj.email === "string" && guestObj.email) ||
    (typeof d.user_email === "string" && d.user_email) ||
    (typeof guestObj.user_email === "string" && guestObj.user_email) ||
    "";

  const firstName =
    (typeof guestObj.first_name === "string" && guestObj.first_name) ||
    (typeof guestObj.user_first_name === "string" && guestObj.user_first_name) ||
    "";

  const lastName =
    (typeof guestObj.last_name === "string" && guestObj.last_name) ||
    (typeof guestObj.user_last_name === "string" && guestObj.user_last_name) ||
    "";

  if (!eventId || !guestId) {
    return null;
  }

  return {
    eventId,
    guestId,
    email: email.trim(),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
  };
}

async function handleGuestUpdated(
  payload: NonNullable<ReturnType<typeof extractGuestPayload>>,
  lumaApiKey: string,
  dataPath: string
): Promise<{ ok: boolean; status: number; message: string }> {
  if (localStorage.hasLumaGuestBeenCredited(payload.eventId, payload.guestId, dataPath)) {
    return { ok: true, status: 200, message: "already_credited" };
  }

  const guest = await fetchLumaGuest({
    apiKey: lumaApiKey,
    eventId: payload.eventId,
    guestId: payload.guestId,
  });

  if (!guest) {
    return { ok: false, status: 502, message: "luma_get_guest_failed" };
  }

  if (!guestHasCheckedIn(guest)) {
    return { ok: true, status: 200, message: "not_checked_in" };
  }

  const email =
    payload.email ||
    (typeof guest.user_email === "string" ? guest.user_email : "") ||
    "";
  if (!email) {
    return { ok: false, status: 422, message: "missing_guest_email" };
  }

  const firstName =
    payload.firstName ||
    (typeof guest.user_first_name === "string" ? guest.user_first_name : "") ||
    "Guest";
  const lastName =
    payload.lastName ||
    (typeof guest.user_last_name === "string" ? guest.user_last_name : "") ||
    "";

  const result = await sendCursorCreditToGuest({
    dataPath,
    email,
    firstName,
    lastName,
  });

  if (!result.success) {
    return { ok: false, status: 500, message: result.error ?? "send_failed" };
  }

  localStorage.markLumaGuestCredited(payload.eventId, payload.guestId, dataPath);
  return { ok: true, status: 200, message: "credited" };
}

const port = Number.parseInt(process.env.LUMA_WEBHOOK_PORT ?? "3847", 10);
const lumaApiKey = process.env.LUMA_API_KEY ?? "";
const webhookSecret = process.env.LUMA_WEBHOOK_SECRET ?? "";
const dataPath = process.env.LUMA_DATA_PATH || process.cwd();

if (!lumaApiKey || !webhookSecret) {
  console.error(
    "Missing LUMA_API_KEY or LUMA_WEBHOOK_SECRET. Set both before starting the webhook server."
  );
  process.exit(1);
}

Bun.serve({
  port,
  async fetch(req) {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const url = new URL(req.url);
    if (url.pathname !== "/luma/webhook" && url.pathname !== "/") {
      return new Response("Not Found", { status: 404 });
    }

    const rawBody = await req.text();
    const sig = req.headers.get("webhook-signature") ?? undefined;
    const ts = req.headers.get("webhook-timestamp") ?? undefined;

    if (!isWebhookTimestampFresh(ts)) {
      return new Response(JSON.stringify({ error: "stale_timestamp" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!verifyLumaWebhookSignature(webhookSecret, sig, rawBody)) {
      return new Response(JSON.stringify({ error: "invalid_signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody) as unknown;
    } catch {
      return new Response(JSON.stringify({ error: "invalid_json" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = extractGuestPayload(parsed);
    if (!payload) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const out = await handleGuestUpdated(payload, lumaApiKey, dataPath);
    return new Response(JSON.stringify({ ok: out.ok, message: out.message }), {
      status: out.status,
      headers: { "Content-Type": "application/json" },
    });
  },
});

console.log(
  `Luma webhook server listening on http://127.0.0.1:${port}/luma/webhook (data: ${dataPath})`
);
