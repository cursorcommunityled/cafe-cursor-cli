const LUMA_BASE = "https://public-api.luma.com";

export interface LumaGuestTicket {
  checked_in_at?: string | null;
}

export interface LumaGuest {
  id?: string;
  user_email?: string | null;
  user_first_name?: string | null;
  user_last_name?: string | null;
  event_tickets?: LumaGuestTicket[] | null;
}

export async function fetchLumaGuest(params: {
  apiKey: string;
  eventId: string;
  guestId: string;
}): Promise<LumaGuest | null> {
  const url = new URL(`${LUMA_BASE}/v1/event/get-guest`);
  url.searchParams.set("event_id", params.eventId);
  url.searchParams.set("id", params.guestId);

  const res = await fetch(url.toString(), {
    headers: {
      "x-luma-api-key": params.apiKey,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    return null;
  }

  const json = (await res.json()) as { guest?: LumaGuest };
  return json.guest ?? null;
}

export function guestHasCheckedIn(guest: LumaGuest): boolean {
  const tickets = guest.event_tickets;
  if (!tickets || tickets.length === 0) {
    return false;
  }
  return tickets.some((t) => Boolean(t.checked_in_at));
}
