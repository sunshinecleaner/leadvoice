import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { logger } from "../../lib/logger.js";
import * as vapiService from "../vapi/vapi.service.js";
import * as smsService from "../sms/sms.service.js";
import { prisma } from "@leadvoice/database";

export async function webhooksRoutes(app: FastifyInstance) {
  // ─── VAPI webhook ────────────────────────────────────────────────────────────
  app.post("/vapi", async (request, reply) => {
    const body = request.body as {
      message: {
        type: string;
        call?: {
          id: string;
          type?: string;
          customer?: { number: string };
          [key: string]: unknown;
        };
        [key: string]: unknown;
      };
    };

    const messageType = body?.message?.type;
    const vapiCallId = body?.message?.call?.id;

    logger.info({ type: messageType, vapiCallId }, "VAPI webhook received");

    switch (messageType) {
      // Inbound call just started — find or create lead immediately
      case "call-started": {
        const callType = body.message.call?.type;
        if (callType === "inboundPhoneCall") {
          const callerPhone = body.message.call?.customer?.number;
          if (vapiCallId && callerPhone) {
            await vapiService.processInboundCallStarted(vapiCallId, callerPhone);
          }
        }
        break;
      }

      // Full call report when call ends — main event
      case "end-of-call-report": {
        // Log full payload to find where VAPI puts structured data
        logger.info({ fullPayload: JSON.stringify(body.message).slice(0, 8000) }, "VAPI end-of-call-report FULL PAYLOAD");

        const callData = body.message as unknown as {
          call: { id: string; type?: string; customer?: { number: string } };
          recordingUrl?: string;
          transcript?: string;
          summary?: string;
          duration?: number;
          cost?: number;
          analysis?: {
            successEvaluation?: string;
            summary?: string;
            structuredData?: Record<string, unknown>;
          };
          // VAPI may put structured outputs at different locations
          structuredData?: Record<string, unknown>;
          structuredOutputs?: Record<string, unknown>;
        };

        // Look for structured data in multiple possible locations
        const msg = body.message as any;
        const structuredData =
          callData.analysis?.structuredData ||
          callData.structuredData ||
          callData.structuredOutputs ||
          msg.structuredData ||
          msg.structuredOutputs ||
          {};

        // Log all top-level keys to find where VAPI puts structured data
        logger.info({ topLevelKeys: Object.keys(msg), analysisKeys: msg.analysis ? Object.keys(msg.analysis) : [] }, "VAPI payload keys");

        if (callData.call?.id) {
          // Merge structuredData into analysis if found outside
          const analysis = {
            ...callData.analysis,
            structuredData: Object.keys(structuredData).length > 0
              ? structuredData
              : callData.analysis?.structuredData,
          };

          await vapiService.processCallCompleted(callData.call.id, {
            id: callData.call.id,
            recordingUrl: callData.recordingUrl || "",
            transcript: callData.transcript || "",
            summary: callData.summary || "",
            duration: callData.duration || 0,
            cost: callData.cost || 0,
            analysis: analysis as any,
            customerPhone: callData.call.customer?.number,
          } as any);
        }
        break;
      }

      case "status-update": {
        const status = (body.message as any).status;
        logger.info({ vapiCallId, status }, "VAPI call status update");
        break;
      }

      case "transcript":
        logger.debug({ vapiCallId }, "VAPI transcript chunk received");
        break;

      default:
        logger.debug({ type: messageType }, "Unhandled VAPI webhook type");
    }

    return reply.send({ success: true });
  });

  // ─── N8N webhook ─────────────────────────────────────────────────────────────
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

  // ─── Twilio SMS webhook ─────────────────────────────────────────────────────
  app.post("/twilio/sms", async (request, reply) => {
    const body = request.body as Record<string, string>;
    const { From, To, Body, MessageSid } = body;

    if (!From || !Body || !MessageSid) {
      logger.warn({ body }, "Invalid Twilio SMS webhook payload");
      return reply.status(400).send({ success: false, error: "Missing required fields" });
    }

    logger.info({ from: From, to: To, sid: MessageSid }, "Twilio inbound SMS webhook");

    await smsService.processInboundSms({ From, To: To || "", Body, MessageSid });

    // Twilio expects TwiML response — empty response means no auto-reply
    reply.type("text/xml");
    return reply.send("<Response></Response>");
  });

  // ─── Generic inbound webhook ─────────────────────────────────────────────────
  app.post("/inbound", async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    logger.info({ keys: Object.keys(body) }, "Inbound webhook received");

    if (body.phone) {
      const lead = await prisma.lead.create({
        data: {
          firstName: String(body.firstName || body.first_name || "Unknown"),
          lastName: String(body.lastName || body.last_name || ""),
          phone: String(body.phone),
          email: body.email ? String(body.email) : undefined,
          source: "API",
          metadata: body as any,
        },
      });
      return reply.status(201).send({ success: true, data: lead });
    }

    return reply.send({ success: true, message: "Webhook received" });
  });
}
