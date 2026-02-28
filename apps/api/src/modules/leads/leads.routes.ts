import type { FastifyInstance } from "fastify";
import { authenticate } from "../auth/auth.middleware.js";
import { createLeadSchema, updateLeadSchema, bulkAssignSchema } from "./leads.schema.js";
import * as leadsService from "./leads.service.js";
import { importLeadsFromCsv } from "./leads.import.js";
import { parsePagination } from "../../utils/helpers.js";

export async function leadsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // List leads
  app.get("/", async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const pagination = parsePagination(query);
    const filters = {
      status: typeof query.status === "string" ? query.status : undefined,
      source: typeof query.source === "string" ? query.source : undefined,
    };
    const result = await leadsService.getLeads(pagination, filters);
    return reply.send({ success: true, ...result });
  });

  // Get lead by ID
  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const lead = await leadsService.getLeadById(id);
    return reply.send({ success: true, data: lead });
  });

  // Create lead
  app.post("/", async (request, reply) => {
    const body = createLeadSchema.parse(request.body);
    const lead = await leadsService.createLead(body);
    return reply.status(201).send({ success: true, data: lead });
  });

  // Update lead
  app.put("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateLeadSchema.parse(request.body);
    const lead = await leadsService.updateLead(id, body);
    return reply.send({ success: true, data: lead });
  });

  // Delete lead
  app.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await leadsService.deleteLead(id);
    return reply.send({ success: true, message: "Lead deleted" });
  });

  // Import CSV
  app.post("/import", async (request, reply) => {
    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ success: false, error: "No file uploaded" });
    }

    const buffer = await file.toBuffer();
    const result = await importLeadsFromCsv(buffer);

    return reply.send({
      success: true,
      data: result,
    });
  });

  // Bulk assign
  app.post("/bulk-assign", async (request, reply) => {
    const body = bulkAssignSchema.parse(request.body);
    const result = await leadsService.bulkAssignLeads(body.leadIds, body.assignedToId);
    return reply.send({ success: true, data: { updated: result.count } });
  });
}
