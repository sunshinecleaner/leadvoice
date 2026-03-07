import { prisma, CallStatus, CallDirection, LeadStatus } from "@leadvoice/database";
import * as vapiClient from "./vapi.client.js";
import { logger } from "../../lib/logger.js";
import { env } from "../../config/env.js";

// Note: new enum values (CrmStage, ServiceType, etc.) use string literals
// because the local Prisma client hasn't been regenerated yet.
// After `prisma generate` runs on the server these will resolve correctly.

// ─── Initiate outbound call ───────────────────────────────────────────────────

export async function initiateCall(params: {
  leadId: string;
  campaignLeadId?: string;
  assistantId?: string;
  scriptOverride?: string;
}) {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: params.leadId } });

  const call = await prisma.call.create({
    data: {
      leadId: params.leadId,
      campaignLeadId: params.campaignLeadId || null,
      status: CallStatus.INITIATED,
      direction: CallDirection.OUTBOUND,
    },
  });

  try {
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

    await (prisma.call.update as any)({
      where: { id: call.id },
      data: {
        vapiCallId: vapiCall.id,
        status: CallStatus.RINGING,
      },
    });

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
    await prisma.call.update({
      where: { id: call.id },
      data: { status: CallStatus.FAILED },
    });
    throw error;
  }
}

// ─── Handle inbound call started ─────────────────────────────────────────────

export async function processInboundCallStarted(vapiCallId: string, callerPhone: string) {
  let lead = await prisma.lead.findFirst({
    where: { phone: callerPhone },
    orderBy: { createdAt: "desc" },
  });

  if (!lead) {
    lead = await (prisma.lead.create as any)({
      data: {
        firstName: "Unknown",
        lastName: "",
        phone: callerPhone,
        source: "INBOUND_CALL",
        status: LeadStatus.NEW,
        crmStage: "LEAD_NEW",
        tags: ["lead-new", "inbound"],
      },
    });
    logger.info({ leadId: lead!.id, phone: callerPhone }, "New inbound lead created");
  }

  const call = await (prisma.call.create as any)({
    data: {
      leadId: lead!.id,
      vapiCallId,
      status: CallStatus.IN_PROGRESS,
      direction: CallDirection.INBOUND,
      startedAt: new Date(),
    },
  });

  await prisma.callEvent.create({
    data: {
      callId: call.id,
      event: "vapi.call.started",
      data: { vapiCallId, callerPhone },
    },
  });

  return { call, lead: lead! };
}

// ─── Process completed call (end-of-call-report) ─────────────────────────────

export async function processCallCompleted(
  vapiCallId: string,
  vapiData: vapiClient.VapiCall & { customerPhone?: string },
) {
  // Find call by vapiCallId first, fallback to twilioCallSid (legacy)
  let call = await (prisma.call.findFirst as any)({ where: { vapiCallId } });
  if (!call) {
    call = await prisma.call.findFirst({ where: { twilioCallSid: vapiCallId } });
  }

  // For calls that started without being tracked (inbound or test calls)
  if (!call) {
    const phone = vapiData.customerPhone || "test-call";
    logger.info({ vapiCallId, phone }, "Creating call record for untracked call");
    const result = await processInboundCallStarted(vapiCallId, phone);
    call = result.call;
  }

  const structured = (vapiData.analysis?.structuredData ?? {}) as Record<string, unknown>;
  const outcome = mapVapiOutcome(vapiData.analysis?.successEvaluation, structured);

  const updated = await (prisma.call.update as any)({
    where: { id: call.id },
    data: {
      vapiCallId,
      status: CallStatus.COMPLETED,
      duration: Math.round(vapiData.duration || 0),
      recordingUrl: vapiData.recordingUrl,
      transcription: vapiData.transcript,
      summary: vapiData.summary || vapiData.analysis?.summary,
      outcome,
      endedAt: new Date(),
    },
  });

  await prisma.callEvent.create({
    data: {
      callId: call.id,
      event: "vapi.call.completed",
      data: {
        duration: vapiData.duration,
        summary: vapiData.summary,
        cost: vapiData.cost,
        analysis: vapiData.analysis as any,
      },
    },
  });

  await updateLeadFromStructuredData(call.leadId, structured, outcome);

  if (structured.serviceType) {
    await createServiceRequest(call.leadId, structured);
  }

  if (call.campaignLeadId) {
    await prisma.campaignLead.update({
      where: { id: call.campaignLeadId },
      data: {
        status: "COMPLETED",
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    });
  }

  const n8nPayload = {
    callId: call.id,
    leadId: call.leadId,
    vapiCallId,
    outcome,
    duration: vapiData.duration,
    transcript: vapiData.transcript,
    summary: vapiData.summary,
    structuredData: structured,
  };

  await triggerN8N("call_completed", n8nPayload);

  // Send SMS alert for qualified leads
  const qualifiedOutcomes = ["INTERESTED", "SCHEDULED", "DEPOSIT_REQUESTED"];
  if (qualifiedOutcomes.includes(outcome)) {
    await triggerN8NSms(n8nPayload);
  }

  logger.info({ callId: call.id, outcome, duration: vapiData.duration }, "Call completed");
  return updated;
}

// ─── Update lead from structured data ────────────────────────────────────────

async function updateLeadFromStructuredData(
  leadId: string,
  data: Record<string, unknown>,
  outcome: string,
) {
  const crmStage = mapOutcomeToCrmStage(outcome, data);

  await (prisma.lead.update as any)({
    where: { id: leadId },
    data: {
      ...(data.firstName ? { firstName: String(data.firstName) } : {}),
      ...(data.lastName ? { lastName: String(data.lastName) } : {}),
      ...(data.address ? { address: String(data.address) } : {}),
      ...(data.city ? { city: String(data.city) } : {}),
      ...(data.state ? { state: String(data.state) } : {}),
      ...(data.zipCode ? { zipCode: String(data.zipCode) } : {}),
      ...(data.propertyType ? { propertyType: mapPropertyType(String(data.propertyType)) } : {}),
      ...(data.bedrooms ? { bedrooms: Number(data.bedrooms) } : {}),
      ...(data.bathrooms ? { bathrooms: Number(data.bathrooms) } : {}),
      ...(data.sqft ? { sqft: Number(data.sqft) } : {}),
      ...(data.isOccupied !== undefined ? { isOccupied: Boolean(data.isOccupied) } : {}),
      ...(data.conditionLevel ? { conditionLevel: mapConditionLevel(String(data.conditionLevel)) } : {}),
      ...(data.preferredSchedule ? { preferredSchedule: String(data.preferredSchedule) } : {}),
      ...(data.language ? { language: String(data.language).toUpperCase() === "ES" ? "ES" : "EN" } : {}),
      status:
        outcome === "INTERESTED" || outcome === "SCHEDULED"
          ? LeadStatus.QUALIFIED
          : outcome === "NOT_INTERESTED"
          ? LeadStatus.LOST
          : LeadStatus.CONTACTED,
      crmStage,
      tags: buildTags(outcome, data),
    },
  });
}

// ─── Create service request ───────────────────────────────────────────────────

async function createServiceRequest(leadId: string, data: Record<string, unknown>) {
  const serviceType = mapServiceType(String(data.serviceType));
  if (!serviceType) return;

  const isDeepCleaning = serviceType === "DEEP_CLEANING";

  await (prisma as any).serviceRequest.create({
    data: {
      leadId,
      serviceType,
      frequency: mapFrequency(String(data.frequency || "one_time")),
      addOns: Array.isArray(data.addOns) ? data.addOns.map(String) : [],
      checklistSent: false,
      depositRequired: isDeepCleaning,
      depositAmount: isDeepCleaning ? 150 : null,
      paymentStatus: "PENDING",
      notes: data.notes ? String(data.notes) : null,
    },
  });
}

// ─── Trigger N8N ─────────────────────────────────────────────────────────────

async function triggerN8N(event: string, data: Record<string, unknown>) {
  if (!env.N8N_WEBHOOK_URL) return;

  try {
    await fetch(env.N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, data, timestamp: new Date().toISOString() }),
    });
    logger.info({ event }, "N8N webhook triggered");
  } catch (error) {
    logger.error({ error, event }, "Failed to trigger N8N webhook");
  }
}

async function triggerN8NSms(data: Record<string, unknown>) {
  if (!env.N8N_SMS_WEBHOOK_URL) return;

  try {
    await fetch(env.N8N_SMS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "sms_alert", data, timestamp: new Date().toISOString() }),
    });
    logger.info("N8N SMS webhook triggered");
  } catch (error) {
    logger.error({ error }, "Failed to trigger N8N SMS webhook");
  }
}

// ─── Get VAPI assistants ──────────────────────────────────────────────────────

export async function getAssistants() {
  return vapiClient.listAssistants();
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapVapiOutcome(
  evaluation?: string,
  structured?: Record<string, unknown>,
): string {
  if (structured?.outcome) {
    const o = String(structured.outcome).toLowerCase();
    if (o === "scheduled") return "SCHEDULED";
    if (o === "deposit_requested") return "DEPOSIT_REQUESTED";
    if (o === "callback") return "CALLBACK";
    if (o === "not_interested") return "NOT_INTERESTED";
    if (o === "voicemail") return "VOICEMAIL";
    if (o === "interested") return "INTERESTED";
  }

  if (!evaluation) return "ERROR";
  const lower = evaluation.toLowerCase();
  if (lower.includes("scheduled")) return "SCHEDULED";
  if (lower.includes("success") || lower.includes("interested")) return "INTERESTED";
  if (lower.includes("callback") || lower.includes("later")) return "CALLBACK";
  if (lower.includes("transfer")) return "TRANSFERRED";
  if (lower.includes("voicemail")) return "VOICEMAIL";
  return "NOT_INTERESTED";
}

function mapOutcomeToCrmStage(outcome: string, _structured: Record<string, unknown>): string {
  if (outcome === "SCHEDULED") return "SCHEDULED";
  if (outcome === "DEPOSIT_REQUESTED") return "CHECKLIST_SENT";
  if (outcome === "INTERESTED") return "LEAD_QUALIFIED";
  if (outcome === "CALLBACK") return "LEAD_NEW";
  return "LEAD_NEW";
}

function buildTags(outcome: string, structured: Record<string, unknown>): string[] {
  const tags: string[] = [];

  if (outcome === "INTERESTED" || outcome === "SCHEDULED") tags.push("lead-qualified");
  if (outcome === "SCHEDULED") tags.push("scheduled");
  if (outcome === "CALLBACK") tags.push("callback-requested");
  if (outcome === "DEPOSIT_REQUESTED") tags.push("deposit-required");

  if (structured.serviceType) {
    const st = String(structured.serviceType).toLowerCase();
    if (st.includes("deep")) tags.push("deep-cleaning", "deposit-required");
    else if (st.includes("standard")) tags.push("standard-cleaning");
    else if (st.includes("recurring")) tags.push("recurring-client");
    else if (st.includes("move")) tags.push("move-cleaning");
  }

  if (String(structured.language || "").toLowerCase() === "es") tags.push("spanish-speaker");

  return tags;
}

function mapPropertyType(value: string): string | undefined {
  const map: Record<string, string> = {
    house: "HOUSE",
    apartment: "APARTMENT",
    condo: "CONDO",
    office: "OFFICE",
  };
  return map[value.toLowerCase()];
}

function mapConditionLevel(value: string): string | undefined {
  const map: Record<string, string> = {
    light: "LIGHT",
    moderate: "MODERATE",
    heavy: "HEAVY",
  };
  return map[value.toLowerCase()];
}

function mapServiceType(value: string): string | undefined {
  const lower = value.toLowerCase();
  if (lower.includes("deep")) return "DEEP_CLEANING";
  if (lower.includes("standard")) return "STANDARD_CLEANING";
  if (lower.includes("recurring")) return "RECURRING";
  if (lower.includes("move_in") || lower.includes("move-in")) return "MOVE_IN";
  if (lower.includes("move_out") || lower.includes("move-out")) return "MOVE_OUT";
  if (lower.includes("construction")) return "POST_CONSTRUCTION";
  return undefined;
}

function mapFrequency(value: string): string {
  const lower = value.toLowerCase();
  if (lower.includes("bi") && lower.includes("weekly")) return "BI_WEEKLY";
  if (lower.includes("weekly")) return "WEEKLY";
  if (lower.includes("monthly")) return "MONTHLY";
  return "ONE_TIME";
}
