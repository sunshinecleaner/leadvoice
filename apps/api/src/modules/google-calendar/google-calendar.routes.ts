import type { FastifyInstance } from "fastify";
import type { JwtPayload } from "@leadvoice/shared";
import { authenticate } from "../auth/auth.middleware.js";
import * as gcService from "./google-calendar.service.js";
import { logger } from "../../lib/logger.js";

export async function googleCalendarRoutes(app: FastifyInstance) {
  // Get OAuth URL
  app.get("/auth/url", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const url = gcService.getAuthUrl(user.userId);
    return reply.send({ success: true, data: { url } });
  });

  // OAuth callback (redirects browser)
  app.get("/auth/callback", async (request, reply) => {
    const { code, state, error } = request.query as Record<string, string>;
    if (error || !code || !state) {
      return reply.redirect("https://leadvoice.sunshinebrazilian.com/calendar?error=oauth_failed");
    }
    try {
      await gcService.handleCallback(code, state);
      return reply.redirect("https://leadvoice.sunshinebrazilian.com/calendar?connected=true");
    } catch (err) {
      logger.error({ err }, "Google Calendar OAuth callback failed");
      return reply.redirect("https://leadvoice.sunshinebrazilian.com/calendar?error=oauth_failed");
    }
  });

  // Disconnect
  app.delete("/auth/disconnect", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    await gcService.disconnect(user.userId);
    return reply.send({ success: true });
  });

  // Status
  app.get("/status", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const status = await gcService.getStatus(user.userId);
    return reply.send({ success: true, data: status });
  });

  // Get events for calendar view
  app.get("/events", { preHandler: [authenticate] }, async (request, reply) => {
    const user = request.user as JwtPayload;
    const { timeMin, timeMax } = request.query as { timeMin?: string; timeMax?: string };
    const events = await gcService.getEventsForRange(
      user.userId,
      timeMin ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      timeMax ?? new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
    );
    return reply.send({ success: true, data: events });
  });
}

// Standalone webhook handler (used in webhooks.routes.ts)
export async function googleCalendarWebhookHandler(request: any, reply: any) {
  const channelId = request.headers["x-goog-channel-id"] as string;
  const state = request.headers["x-goog-resource-state"] as string;

  if (!channelId || state === "sync") {
    return reply.status(200).send();
  }

  gcService.processWebhookNotification(channelId).catch((err) =>
    logger.error({ err, channelId }, "Google webhook processing error")
  );

  return reply.status(200).send();
}
