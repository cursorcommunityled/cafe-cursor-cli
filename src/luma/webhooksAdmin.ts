const LUMA_BASE = "https://public-api.luma.com";

export type LumaWebhookEventType =
  | "*"
  | "calendar.event.added"
  | "calendar.person.subscribed"
  | "event.canceled"
  | "event.created"
  | "event.updated"
  | "guest.registered"
  | "guest.updated"
  | "ticket.registered";

export interface LumaWebhook {
  id: string;
  url: string;
  event_types: LumaWebhookEventType[];
  status: "active" | "paused";
  secret: string;
  created_at: string;
}

async function lumaPost<T>(apiKey: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${LUMA_BASE}${path}`, {
    method: "POST",
    headers: {
      "x-luma-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Luma API invalid JSON (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    const msg =
      json && typeof json === "object" && "error" in json
        ? String((json as { error: unknown }).error)
        : text.slice(0, 300);
    throw new Error(`Luma API ${res.status}: ${msg}`);
  }

  return json as T;
}

async function lumaGet<T>(apiKey: string, path: string): Promise<T> {
  const res = await fetch(`${LUMA_BASE}${path}`, {
    headers: {
      "x-luma-api-key": apiKey,
      Accept: "application/json",
    },
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Luma API invalid JSON (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    const msg =
      json && typeof json === "object" && "error" in json
        ? String((json as { error: unknown }).error)
        : text.slice(0, 300);
    throw new Error(`Luma API ${res.status}: ${msg}`);
  }

  return json as T;
}

/**
 * Register a webhook via Luma API (operator / server-side only).
 * @see https://docs.luma.com/reference/post_v1-webhooks-create
 */
export async function createLumaWebhook(params: {
  apiKey: string;
  url: string;
  eventTypes: LumaWebhookEventType[];
}): Promise<LumaWebhook> {
  const out = await lumaPost<{ webhook: LumaWebhook }>(params.apiKey, "/v1/webhooks/create", {
    url: params.url,
    event_types: params.eventTypes,
  });
  if (!out.webhook) {
    throw new Error("Luma API returned no webhook");
  }
  return out.webhook;
}

/** Check-in automation: only guest.updated (Luma's signal for check-in changes). */
export async function createCheckInWebhook(
  apiKey: string,
  publicUrl: string
): Promise<LumaWebhook> {
  return createLumaWebhook({
    apiKey,
    url: publicUrl,
    eventTypes: ["guest.updated"],
  });
}

/**
 * List webhooks for the calendar tied to the API key.
 * @see https://docs.luma.com/reference/get_v1-webhooks-list
 */
export async function listLumaWebhooks(apiKey: string): Promise<{
  entries: LumaWebhook[];
  has_more: boolean;
  next_cursor?: string;
}> {
  return lumaGet(apiKey, "/v1/webhooks/list");
}
