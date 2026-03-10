import type { FastifyInstance } from "fastify";
import { authenticate } from "../auth/auth.middleware.js";
import * as callsService from "./calls.service.js";
import { parsePagination } from "../../utils/helpers.js";

export async function callsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // List calls (paginated)
  app.get("/", async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const pagination = parsePagination(query);
    const filters = {
      status: typeof query.status === "string" ? query.status : undefined,
      direction: typeof query.direction === "string" ? query.direction : undefined,
      leadId: typeof query.leadId === "string" ? query.leadId : undefined,
    };
    const result = await callsService.getCalls(pagination, filters);
    return reply.send({ success: true, ...result });
  });

  // Get call by ID
  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const call = await callsService.getCallById(id);
    return reply.send({ success: true, data: call });
  });
}
