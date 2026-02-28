import type { FastifyInstance } from "fastify";
import { authenticate } from "../auth/auth.middleware.js";
import { createCampaignSchema, updateCampaignSchema, addLeadsToCampaignSchema } from "./campaigns.schema.js";
import * as campaignsService from "./campaigns.service.js";
import { parsePagination } from "../../utils/helpers.js";

export async function campaignsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // List campaigns
  app.get("/", async (request, reply) => {
    const pagination = parsePagination(request.query as Record<string, unknown>);
    const result = await campaignsService.getCampaigns(pagination);
    return reply.send({ success: true, ...result });
  });

  // Get campaign by ID
  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await campaignsService.getCampaignById(id);
    return reply.send({ success: true, data: campaign });
  });

  // Create campaign
  app.post("/", async (request, reply) => {
    const body = createCampaignSchema.parse(request.body);
    const campaign = await campaignsService.createCampaign(body, request.user.userId);
    return reply.status(201).send({ success: true, data: campaign });
  });

  // Update campaign
  app.put("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateCampaignSchema.parse(request.body);
    const campaign = await campaignsService.updateCampaign(id, body);
    return reply.send({ success: true, data: campaign });
  });

  // Delete campaign
  app.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await campaignsService.deleteCampaign(id);
    return reply.send({ success: true, message: "Campaign deleted" });
  });

  // Start campaign
  app.post("/:id/start", async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await campaignsService.startCampaign(id);
    return reply.send({ success: true, data: campaign });
  });

  // Pause campaign
  app.post("/:id/pause", async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await campaignsService.pauseCampaign(id);
    return reply.send({ success: true, data: campaign });
  });

  // Add leads to campaign
  app.post("/:id/leads", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = addLeadsToCampaignSchema.parse(request.body);
    const result = await campaignsService.addLeadsToCampaign(id, body.leadIds);
    return reply.send({ success: true, data: result });
  });
}
