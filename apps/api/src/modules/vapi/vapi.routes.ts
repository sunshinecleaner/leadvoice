import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../auth/auth.middleware.js";
import * as vapiService from "./vapi.service.js";
import * as vapiClient from "./vapi.client.js";

export async function vapiRoutes(app: FastifyInstance) {
  // Initiate a call (authenticated)
  app.post("/call", { preHandler: [authenticate] }, async (request, reply) => {
    const body = z
      .object({
        leadId: z.string(),
        campaignLeadId: z.string().optional(),
        assistantId: z.string().optional(),
        scriptOverride: z.string().optional(),
      })
      .parse(request.body);

    const result = await vapiService.initiateCall(body);
    return reply.status(201).send({ success: true, data: result });
  });

  // Get VAPI assistants (authenticated)
  app.get("/assistants", { preHandler: [authenticate] }, async (_request, reply) => {
    const assistants = await vapiService.getAssistants();
    return reply.send({ success: true, data: assistants });
  });

  // Get VAPI call details (authenticated)
  app.get("/call/:callId", { preHandler: [authenticate] }, async (request, reply) => {
    const { callId } = request.params as { callId: string };
    const call = await vapiClient.getCall(callId);
    return reply.send({ success: true, data: call });
  });
}
