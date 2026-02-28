import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { logger } from "../../lib/logger.js";
import * as vapiService from "../vapi/vapi.service.js";
import { prisma } from "@leadvoice/database";

export async function webhooksRoutes(app: FastifyInstance) {
  // VAPI webhook — receives call events
  app.post("/vapi", async (request, reply) => {
    const body = request.body as {
      message: {
        type: string;
        call?: { id: string; [key: string]: unknown };
        [key: string]: unknown;
      };
    };

    const messageType = body?.message?.type;

    logger.info({ type: messageType }, "VAPI webhook received");

    switch (messageType) {
      case "end-of-call-report": {
        const callData = body.message as unknown as {
          call: { id: string };
          recordingUrl?: string;
          transcript?: string;
          summary?: string;
          duration?: number;
          cost?: number;
          analysis?: { successEvaluation?: string; summary?: string; structuredData?: Record<string, unknown> };
        };

        if (callData.call?.id) {
          await vapiService.processCallCompleted(callData.call.id, {
            id: callData.call.id,
            recordingUrl: callData.recordingUrl || "",
            transcript: callData.transcript || "",
            summary: callData.summary || "",
            duration: callData.duration || 0,
            cost: callData.cost || 0,
            analysis: callData.analysis as any,
          } as any);
        }
        break;
      }

      case "status-update": {
        const status = (body.message as any).status;
        const callId = body.message.call?.id;
        logger.info({ callId, status }, "VAPI call status update");
        break;
      }

      case "transcript": {
        logger.debug("VAPI transcript update received");
        break;
      }

      default:
        logger.debug({ type: messageType }, "Unhandled VAPI webhook type");
    }

    return reply.send({ success: true });
  });

  // N8N webhook — receive actions from N8N workflows
  app.post("/n8n", async (request, reply) => {
    const body = z
      .object({
        action: z.string(),
        data: z.record(z.unknown()),
      })
      .parse(request.body);

    logger.info({ action: body.action }, "N8N webhook received");

    switch (body.action) {
      case "create_lead": {
        const lead = await prisma.lead.create({
          data: {
            firstName: String(body.data.firstName || ""),
            lastName: String(body.data.lastName || ""),
            phone: String(body.data.phone || ""),
            email: body.data.email ? String(body.data.email) : undefined,
            company: body.data.company ? String(body.data.company) : undefined,
            source: "API",
            metadata: body.data.metadata as any,
          },
        });
        return reply.send({ success: true, data: lead });
      }

      case "update_lead": {
        const updated = await prisma.lead.update({
          where: { id: String(body.data.leadId) },
          data: {
            status: body.data.status as any,
            score: body.data.score ? Number(body.data.score) : undefined,
            notes: body.data.notes ? String(body.data.notes) : undefined,
          },
        });
        return reply.send({ success: true, data: updated });
      }

      case "trigger_call": {
        const result = await vapiService.initiateCall({
          leadId: String(body.data.leadId),
          campaignLeadId: body.data.campaignLeadId ? String(body.data.campaignLeadId) : undefined,
          assistantId: body.data.assistantId ? String(body.data.assistantId) : undefined,
        });
        return reply.send({ success: true, data: result });
      }

      default:
        return reply.status(400).send({ success: false, error: `Unknown action: ${body.action}` });
    }
  });

  // Generic webhook — for external integrations (Zapier, Make, etc.)
  app.post("/inbound", async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    logger.info({ keys: Object.keys(body) }, "Inbound webhook received");

    // Store as a new lead if it has phone data
    if (body.phone) {
      const lead = await prisma.lead.create({
        data: {
          firstName: String(body.firstName || body.first_name || "Unknown"),
          lastName: String(body.lastName || body.last_name || ""),
          phone: String(body.phone),
          email: body.email ? String(body.email) : undefined,
          company: body.company ? String(body.company) : undefined,
          source: "API",
          metadata: body,
        },
      });
      return reply.status(201).send({ success: true, data: lead });
    }

    return reply.send({ success: true, message: "Webhook received" });
  });
}
