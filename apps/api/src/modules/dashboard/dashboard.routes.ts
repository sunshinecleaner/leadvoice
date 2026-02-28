import type { FastifyInstance } from "fastify";
import { authenticate } from "../auth/auth.middleware.js";
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
