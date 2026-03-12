import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface GoogleCalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  colorId?: string;
  extendedProperties?: {
    private?: Record<string, string>;
  };
  htmlLink?: string;
  status?: string;
}

export interface GoogleWatchChannel {
  id: string;
  resourceId: string;
  expiration: string;
}

export async function exchangeCode(code: string): Promise<GoogleTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: env.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token refresh failed: ${err}`);
  }
  return res.json();
}

async function calendarFetch(
  path: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${GOOGLE_CALENDAR_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
}

export async function getUserInfo(accessToken: string): Promise<{ email: string }> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to get user info");
  return res.json();
}

export async function listCalendars(accessToken: string): Promise<{ id: string; summary: string; primary?: boolean }[]> {
  const res = await calendarFetch("/users/me/calendarList", accessToken);
  if (!res.ok) throw new Error("Failed to list calendars");
  const data = await res.json();
  return data.items ?? [];
}

export async function createEvent(
  calendarId: string,
  event: GoogleCalendarEvent,
  accessToken: string
): Promise<GoogleCalendarEvent> {
  const res = await calendarFetch(`/calendars/${encodeURIComponent(calendarId)}/events`, accessToken, {
    method: "POST",
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create event: ${err}`);
  }
  return res.json();
}

export async function updateEvent(
  calendarId: string,
  eventId: string,
  event: Partial<GoogleCalendarEvent>,
  accessToken: string
): Promise<GoogleCalendarEvent> {
  const res = await calendarFetch(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    accessToken,
    { method: "PATCH", body: JSON.stringify(event) }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to update event: ${err}`);
  }
  return res.json();
}

export async function deleteEvent(
  calendarId: string,
  eventId: string,
  accessToken: string
): Promise<void> {
  const res = await calendarFetch(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    accessToken,
    { method: "DELETE" }
  );
  if (!res.ok && res.status !== 404) {
    const err = await res.text();
    throw new Error(`Failed to delete event: ${err}`);
  }
}

export async function listEvents(
  calendarId: string,
  accessToken: string,
  params: { timeMin?: string; timeMax?: string; syncToken?: string } = {}
): Promise<{ items: GoogleCalendarEvent[]; nextSyncToken?: string }> {
  const query = new URLSearchParams({ singleEvents: "true" });
  if (params.syncToken) {
    query.set("syncToken", params.syncToken);
  } else {
    if (params.timeMin) query.set("timeMin", params.timeMin);
    if (params.timeMax) query.set("timeMax", params.timeMax);
  }
  const res = await calendarFetch(
    `/calendars/${encodeURIComponent(calendarId)}/events?${query}`,
    accessToken
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to list events: ${err}`);
  }
  return res.json();
}

export async function watchCalendar(
  calendarId: string,
  channelId: string,
  webhookUrl: string,
  accessToken: string
): Promise<GoogleWatchChannel> {
  const res = await calendarFetch(
    `/calendars/${encodeURIComponent(calendarId)}/events/watch`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        id: channelId,
        type: "web_hook",
        address: webhookUrl,
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    logger.warn({ err }, "Failed to setup calendar watch channel");
    throw new Error(`Failed to watch calendar: ${err}`);
  }
  return res.json();
}

export async function stopWatchChannel(
  channelId: string,
  resourceId: string,
  accessToken: string
): Promise<void> {
  const res = await fetch(`${GOOGLE_CALENDAR_BASE}/channels/stop`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: channelId, resourceId }),
  });
  if (!res.ok && res.status !== 404) {
    logger.warn({ channelId }, "Failed to stop watch channel");
  }
}
