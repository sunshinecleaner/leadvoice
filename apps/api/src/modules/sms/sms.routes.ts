import type { FastifyInstance } from "fastify";
import { authenticate } from "../auth/auth.middleware.js";
import { sendMessageSchema, listMessagesSchema } from "./sms.schema.js";
import * as smsService from "./sms.service.js";

export async function smsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  // Send SMS to a lead
  app.post("/send", async (request, reply) => {
    const body = sendMessageSchema.parse(request.body);
    const message = await smsService.sendMessage(body);
    return reply.status(201).send({ success: true, data: message });
  });

  // List all messages (paginated)
  app.get("/", async (request, reply) => {
    const query = listMessagesSchema.parse(request.query);
    const result = await smsService.listMessages(query);
    return reply.send({ success: true, ...result });
  });

  // Get messages for a specific lead
  app.get("/lead/:leadId", async (request, reply) => {
    const { leadId } = request.params as { leadId: string };
    const messages = await smsService.getMessagesByLead(leadId);
    return reply.send({ success: true, data: messages });
  });
}
