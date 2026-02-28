import { prisma, CallStatus, CallDirection } from "@leadvoice/database";
import * as vapiClient from "./vapi.client.js";
import { logger } from "../../lib/logger.js";

// Initiate an outbound call to a lead via VAPI
export async function initiateCall(params: {
  leadId: string;
  campaignLeadId?: string;
  assistantId?: string;
  scriptOverride?: string;
}) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: params.leadId } });

  // Create call record in DB
  const call = await prisma.call.create({
    data: {
      leadId: params.leadId,
      campaignLeadId: params.campaignLeadId || null,
      status: CallStatus.INITIATED,
      direction: CallDirection.OUTBOUND,
    },
  });

  try {
    // Trigger VAPI call
    const vapiCall = await vapiClient.createCall({
      phoneNumber: lead.phone,
      assistantId: params.assistantId,
      assistantOverrides: params.scriptOverride
        ? { model: { systemPrompt: params.scriptOverride } }
        : undefined,
      metadata: {
        leadvoiceCallId: call.id,
        leadId: lead.id,
        campaignLeadId: params.campaignLeadId,
        leadName: `${lead.firstName} ${lead.lastName}`,
      },
    });

    // Update call with VAPI call ID
    await prisma.call.update({
      where: { id: call.id },
      data: {
        twilioCallSid: vapiCall.id, // reusing field for VAPI call ID
        status: CallStatus.RINGING,
      },
    });

    // Log event
    await prisma.callEvent.create({
      data: {
        callId: call.id,
        event: "vapi.call.initiated",
        data: { vapiCallId: vapiCall.id, phoneNumber: lead.phone },
      },
    });

    logger.info({ callId: call.id, vapiCallId: vapiCall.id }, "VAPI call initiated");
    return { call, vapiCall };
  } catch (error) {
    // Mark call as failed
    await prisma.call.update({
      where: { id: call.id },
      data: { status: CallStatus.FAILED },
    });
    throw error;
  }
}

// Process VAPI webhook when call ends
export async function processCallCompleted(vapiCallId: string, vapiData: vapiClient.VapiCall) {
  const call = await prisma.call.findFirst({
    where: { twilioCallSid: vapiCallId },
  });

  if (!call) {
    logger.warn({ vapiCallId }, "Received webhook for unknown call");
    return null;
  }

  // Map VAPI result to our outcome
  const outcome = mapVapiOutcome(vapiData.analysis?.successEvaluation);

  const updated = await prisma.call.update({
    where: { id: call.id },
    data: {
      status: CallStatus.COMPLETED,
      duration: Math.round(vapiData.duration || 0),
      recordingUrl: vapiData.recordingUrl,
      transcription: vapiData.transcript,
      outcome,
      endedAt: new Date(),
    },
  });

  // Log event
  await prisma.callEvent.create({
    data: {
      callId: call.id,
      event: "vapi.call.completed",
      data: {
        duration: vapiData.duration,
        summary: vapiData.summary,
        analysis: vapiData.analysis,
        cost: vapiData.cost,
      },
    },
  });

  // Update campaign lead status if applicable
  if (call.campaignLeadId) {
    await prisma.campaignLead.update({
      where: { id: call.campaignLeadId },
      data: {
        status: outcome === "INTERESTED" || outcome === "TRANSFERRED" ? "COMPLETED" : "COMPLETED",
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    });
  }

  // Update lead status based on outcome
  if (outcome === "INTERESTED") {
    await prisma.lead.update({
      where: { id: call.leadId },
      data: { status: "QUALIFIED" },
    });
  }

  logger.info({ callId: call.id, outcome, duration: vapiData.duration }, "Call completed");
  return updated;
}

function mapVapiOutcome(evaluation?: string): "INTERESTED" | "NOT_INTERESTED" | "CALLBACK" | "TRANSFERRED" | "VOICEMAIL" | "ERROR" {
  if (!evaluation) return "ERROR";
  const lower = evaluation.toLowerCase();
  if (lower.includes("success") || lower.includes("interested")) return "INTERESTED";
  if (lower.includes("callback") || lower.includes("later")) return "CALLBACK";
  if (lower.includes("transfer")) return "TRANSFERRED";
  if (lower.includes("voicemail")) return "VOICEMAIL";
  return "NOT_INTERESTED";
}

// Get VAPI assistants
export async function getAssistants() {
  return vapiClient.listAssistants();
}
