import { prisma } from "@leadvoice/database";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import * as gcClient from "./google-calendar.client.js";
import crypto from "node:crypto";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

const SERVICE_TYPE_COLOR: Record<string, string> = {
  DEEP_CLEANING: "11",      // Tomato
  STANDARD_CLEANING: "2",   // Sage
  RECURRING: "5",           // Banana
  MOVE_IN: "7",             // Peacock
  MOVE_OUT: "6",            // Tangerine
  POST_CONSTRUCTION: "3",   // Grape
};

// ── OAuth ─────────────────────────────────────────────────────────────────────

export function getAuthUrl(userId: string): string {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI) {
    throw new Error("Google Calendar not configured");
  }
  const state = Buffer.from(JSON.stringify({ userId, nonce: crypto.randomBytes(8).toString("hex") })).toString("base64url");
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function handleCallback(code: string, state: string): Promise<string> {
  const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
  const { userId } = decoded;

  const tokens = await gcClient.exchangeCode(code);
  const userInfo = await gcClient.getUserInfo(tokens.access_token);

  // Get primary calendar id
  const calendars = await gcClient.listCalendars(tokens.access_token);
  const primary = calendars.find((c) => c.primary) ?? calendars[0];

  await prisma.userIntegration.upsert({
    where: { userId_type: { userId, type: "GOOGLE_CALENDAR" } },
    create: {
      userId,
      type: "GOOGLE_CALENDAR",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? "",
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scope: tokens.scope,
      metadata: {
        email: userInfo.email,
        calendarId: primary?.id ?? "primary",
        calendarName: primary?.summary ?? "Primary",
      },
      active: true,
    },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? "",
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scope: tokens.scope,
      metadata: {
        email: userInfo.email,
        calendarId: primary?.id ?? "primary",
        calendarName: primary?.summary ?? "Primary",
      },
      active: true,
    },
  });

  // Setup push notifications (non-blocking)
  setupWatchChannel(userId).catch((err) =>
    logger.warn({ err, userId }, "Failed to setup watch channel")
  );

  return userId;
}

export async function disconnect(userId: string): Promise<void> {
  const integration = await prisma.userIntegration.findUnique({
    where: { userId_type: { userId, type: "GOOGLE_CALENDAR" } },
  });
  if (!integration) return;

  const meta = integration.metadata as Record<string, string> | null;
  if (meta?.watchChannelId && meta?.watchResourceId) {
    await gcClient
      .stopWatchChannel(meta.watchChannelId, meta.watchResourceId, integration.accessToken)
      .catch(() => {});
  }

  await prisma.userIntegration.delete({
    where: { userId_type: { userId, type: "GOOGLE_CALENDAR" } },
  });
}

export async function getStatus(userId: string): Promise<{
  connected: boolean;
  email?: string;
  calendarId?: string;
  calendarName?: string;
}> {
  const integration = await prisma.userIntegration.findUnique({
    where: { userId_type: { userId, type: "GOOGLE_CALENDAR" } },
  });
  if (!integration || !integration.active) return { connected: false };
  const meta = integration.metadata as Record<string, string> | null;
  return {
    connected: true,
    email: meta?.email,
    calendarId: meta?.calendarId,
    calendarName: meta?.calendarName,
  };
}

// ── Token refresh helper ──────────────────────────────────────────────────────

async function getValidAccessToken(userId: string): Promise<{ accessToken: string; calendarId: string } | null> {
  const integration = await prisma.userIntegration.findUnique({
    where: { userId_type: { userId, type: "GOOGLE_CALENDAR" } },
  });
  if (!integration || !integration.active) return null;

  const meta = integration.metadata as Record<string, string> | null;
  const calendarId = meta?.calendarId ?? "primary";

  // Refresh if expiring within 5 minutes
  if (integration.expiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
    try {
      const refreshed = await gcClient.refreshAccessToken(integration.refreshToken);
      await prisma.userIntegration.update({
        where: { userId_type: { userId, type: "GOOGLE_CALENDAR" } },
        data: {
          accessToken: refreshed.access_token,
          expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        },
      });
      return { accessToken: refreshed.access_token, calendarId };
    } catch (err) {
      logger.error({ err, userId }, "Failed to refresh Google token");
      return null;
    }
  }

  return { accessToken: integration.accessToken, calendarId };
}

// ── Calendar Events ───────────────────────────────────────────────────────────

export async function createEventForServiceRequest(serviceRequestId: string): Promise<void> {
  const sr = await prisma.serviceRequest.findUnique({
    where: { id: serviceRequestId },
    include: { lead: { include: { assignedTo: true } } },
  });
  if (!sr) return;

  // Find the user to use for calendar (assigned agent or first admin)
  const lead = sr.lead;
  const userId = lead.assignedToId ?? (await getFirstAdmin());
  if (!userId) return;

  const tokens = await getValidAccessToken(userId);
  if (!tokens) return;

  const startTime = sr.scheduledDate ?? new Date(Date.now() + 24 * 60 * 60 * 1000);
  const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // 2 hours

  const leadName = `${lead.firstName} ${lead.lastName}`.trim();
  const serviceLabel = sr.serviceType.replace(/_/g, " ");
  const address = [lead.address, lead.city, lead.state].filter(Boolean).join(", ");

  const event: gcClient.GoogleCalendarEvent = {
    summary: `${serviceLabel} — ${leadName}`,
    description: [
      address ? `📍 ${address}` : null,
      lead.propertyType ? `🏠 ${lead.propertyType.replace(/_/g, " ")}` : null,
      lead.bedrooms || lead.bathrooms ? `🛏 ${lead.bedrooms ?? "?"}bd / ${lead.bathrooms ?? "?"}ba` : null,
      lead.sqft ? `📐 ${lead.sqft} sqft` : null,
      lead.conditionLevel ? `🧹 Condition: ${lead.conditionLevel}` : null,
      lead.phone ? `📞 ${lead.phone}` : null,
      sr.notes ? `📝 ${sr.notes}` : null,
      `\n🔗 Lead ID: ${lead.id}`,
    ]
      .filter(Boolean)
      .join("\n"),
    start: { dateTime: startTime.toISOString(), timeZone: "America/New_York" },
    end: { dateTime: endTime.toISOString(), timeZone: "America/New_York" },
    colorId: SERVICE_TYPE_COLOR[sr.serviceType] ?? "1",
    extendedProperties: {
      private: {
        leadvoiceLeadId: lead.id,
        leadvoiceServiceRequestId: sr.id,
      },
    },
  };

  try {
    const created = await gcClient.createEvent(tokens.calendarId, event, tokens.accessToken);
    await prisma.serviceRequest.update({
      where: { id: serviceRequestId },
      data: {
        googleCalendarEventId: created.id,
        googleCalendarLink: created.htmlLink,
      },
    });
    logger.info({ serviceRequestId, eventId: created.id }, "Google Calendar event created");
  } catch (err) {
    logger.error({ err, serviceRequestId }, "Failed to create Google Calendar event");
  }
}

export async function getEventsForRange(
  userId: string,
  timeMin: string,
  timeMax: string
): Promise<gcClient.GoogleCalendarEvent[]> {
  const tokens = await getValidAccessToken(userId);
  if (!tokens) return [];
  try {
    const result = await gcClient.listEvents(tokens.calendarId, tokens.accessToken, { timeMin, timeMax });
    return result.items ?? [];
  } catch (err) {
    logger.error({ err, userId }, "Failed to fetch calendar events");
    return [];
  }
}

// ── Watch Channel ─────────────────────────────────────────────────────────────

async function setupWatchChannel(userId: string): Promise<void> {
  const tokens = await getValidAccessToken(userId);
  if (!tokens) return;

  const channelId = crypto.randomUUID();
  const webhookUrl = `https://api.sunshinebrazilian.com/api/webhooks/google-calendar`;

  try {
    const channel = await gcClient.watchCalendar(tokens.calendarId, channelId, webhookUrl, tokens.accessToken);
    await prisma.userIntegration.update({
      where: { userId_type: { userId, type: "GOOGLE_CALENDAR" } },
      data: {
        metadata: {
          ...(await getCurrentMeta(userId)),
          watchChannelId: channel.id,
          watchResourceId: channel.resourceId,
          watchExpiry: channel.expiration,
        },
      },
    });
    logger.info({ userId, channelId }, "Google Calendar watch channel created");
  } catch (err) {
    logger.warn({ err, userId }, "Watch channel setup failed (non-critical)");
  }
}

async function getCurrentMeta(userId: string): Promise<Record<string, string>> {
  const integration = await prisma.userIntegration.findUnique({
    where: { userId_type: { userId, type: "GOOGLE_CALENDAR" } },
  });
  return (integration?.metadata as Record<string, string>) ?? {};
}

// ── Inbound Webhook Processing ────────────────────────────────────────────────

export async function processWebhookNotification(channelId: string): Promise<void> {
  // Find the integration with this watch channel
  const integrations = await prisma.userIntegration.findMany({
    where: { type: "GOOGLE_CALENDAR", active: true },
  });

  const integration = integrations.find((i) => {
    const meta = i.metadata as Record<string, string> | null;
    return meta?.watchChannelId === channelId;
  });

  if (!integration) {
    logger.warn({ channelId }, "Unknown watch channel notification");
    return;
  }

  const meta = integration.metadata as Record<string, string>;
  const tokens = await getValidAccessToken(integration.userId);
  if (!tokens) return;

  try {
    const result = await gcClient.listEvents(tokens.calendarId, tokens.accessToken, {
      syncToken: meta.syncToken,
    });

    for (const event of result.items ?? []) {
      const priv = event.extendedProperties?.private;
      if (!priv?.leadvoiceServiceRequestId) continue;

      const srId = priv.leadvoiceServiceRequestId;

      if (event.status === "cancelled") {
        // Event deleted — clear the scheduled date
        await prisma.serviceRequest.update({
          where: { id: srId },
          data: { scheduledDate: null, googleCalendarEventId: null, googleCalendarLink: null },
        });
        logger.info({ srId }, "Calendar event deleted — cleared scheduledDate");
      } else if (event.start?.dateTime) {
        // Event updated — sync scheduled date
        await prisma.serviceRequest.update({
          where: { id: srId },
          data: { scheduledDate: new Date(event.start.dateTime) },
        });
        logger.info({ srId, newDate: event.start.dateTime }, "Calendar event updated — synced scheduledDate");
      }
    }

    // Save new syncToken
    if (result.nextSyncToken) {
      await prisma.userIntegration.update({
        where: { userId_type: { userId: integration.userId, type: "GOOGLE_CALENDAR" } },
        data: { metadata: { ...meta, syncToken: result.nextSyncToken } },
      });
    }
  } catch (err) {
    logger.error({ err, channelId }, "Failed to process Google Calendar webhook");
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getFirstAdmin(): Promise<string | null> {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", active: true } });
  return admin?.id ?? null;
}
