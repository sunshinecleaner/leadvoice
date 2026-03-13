import type { FastifyInstance, FastifyRequest } from "fastify";
import { authenticate } from "../auth/auth.middleware.js";
import { env } from "../../config/env.js";
import * as dashboardService from "./dashboard.service.js";

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  app.get("/stats", async (_request, reply) => {
    const stats = await dashboardService.getStats();
    return reply.send({ success: true, data: stats });
  });

  app.get("/charts", async (_request, reply) => {
    const charts = await dashboardService.getChartData();
    return reply.send({ success: true, data: charts });
  });
}

export async function dashboardPublicRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (request: FastifyRequest, reply) => {
    const apiKey = request.headers["x-api-key"];
    if (!env.N8N_API_KEY || apiKey !== env.N8N_API_KEY) {
      return reply.status(401).send({ success: false, error: "Invalid API key" });
    }
  });

  app.get("/stats", async (_request, reply) => {
    const stats = await dashboardService.getStats();
    return reply.send({ success: true, data: stats });
  });

  app.get("/leads-today", async (_request, reply) => {
    const leads = await dashboardService.getLeadsToday();
    return reply.send({ success: true, data: leads });
  });
}
