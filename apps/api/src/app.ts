import Fastify from "fastify";
import cors from "@fastify/cors";
import fjwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { AppError } from "./utils/errors.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { leadsRoutes } from "./modules/leads/leads.routes.js";
import { campaignsRoutes } from "./modules/campaigns/campaigns.routes.js";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { vapiRoutes } from "./modules/vapi/vapi.routes.js";
import { webhooksRoutes } from "./modules/webhooks/webhooks.routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: false,
  });

  // Plugins
  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

  await app.register(fjwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
  });

  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  });

  // Decorators
  app.decorate("authenticate", async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ success: false, error: "Unauthorized" });
    }
  });

  // Error handler
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        success: false,
        error: error.message,
      });
    }

    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: "Validation error",
        message: error.message,
      });
    }

    logger.error(error);
    return reply.status(500).send({
      success: false,
      error: "Internal server error",
    });
  });

  // Health check
  app.get("/api/health", async () => ({
    success: true,
    data: { status: "ok", timestamp: new Date().toISOString() },
  }));

  // Routes
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(leadsRoutes, { prefix: "/api/leads" });
  await app.register(campaignsRoutes, { prefix: "/api/campaigns" });
  await app.register(dashboardRoutes, { prefix: "/api/dashboard" });
  await app.register(vapiRoutes, { prefix: "/api/vapi" });
  await app.register(webhooksRoutes, { prefix: "/api/webhooks" });

  return app;
}
