import { prisma, CallStatus, CallDirection, LeadStatus } from "@leadvoice/database";
import * as vapiClient from "./vapi.client.js";
import * as smsService from "../sms/sms.service.js";
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

  // For calls that started without being tracked (dashboard test calls, or missed call-started event)
  if (!call) {
    const phone = vapiData.customerPhone || "unknown";
    logger.info({ vapiCallId, phone }, "Creating call record for untracked call");
    const result = await processInboundCallStarted(vapiCallId, phone);
    call = result.call;
  }

  let structured = (vapiData.analysis?.structuredData ?? {}) as Record<string, unknown>;

  // VAPI Structured Outputs are NOT sent in webhooks — extract via OpenAI
  if (Object.keys(structured).length === 0 && (vapiData.summary || vapiData.transcript)) {
    structured = await extractStructuredDataWithAI(vapiData.summary || "", vapiData.transcript || "");
    logger.info({ extractedData: structured }, "OpenAI extracted structured data from call");
  }

  const outcome = mapVapiOutcome(vapiData.analysis?.successEvaluation, structured);

  logger.info({
    successEvaluation: vapiData.analysis?.successEvaluation,
    structuredData: structured,
    mappedOutcome: outcome,
    summary: vapiData.summary,
  }, "VAPI call analysis data");

  const updated = await (prisma.call.update as any)({
    where: { id: call.id },
    data: {
      vapiCallId,
      status: CallStatus.COMPLETED,
      duration: Math.round(vapiData.duration || 0),
      recordingUrl: vapiData.recordingUrl,
      transcription: vapiData.transcript,
      summary: (structured.summary as string) || vapiData.summary || vapiData.analysis?.summary,
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
    summary: (structured.summary as string) || vapiData.summary,
    structuredData: structured,
  };

  await triggerN8N("call_completed", n8nPayload);

  // Send automatic SMS based on call outcome
  const smsOutcomes = ["INTERESTED", "SCHEDULED", "DEPOSIT_REQUESTED", "VOICEMAIL"];
  if (smsOutcomes.includes(outcome)) {
    await sendAutoSmsToLead(call.leadId, outcome, structured);
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

  // Helper: only include field if value is truthy and not null
  const has = (v: unknown): v is string | number | boolean => v !== null && v !== undefined && v !== "";

  await (prisma.lead.update as any)({
    where: { id: leadId },
    data: {
      ...(has(data.firstName) ? { firstName: String(data.firstName) } : {}),
      ...(has(data.lastName) ? { lastName: String(data.lastName) } : {}),
      ...(has(data.address) ? { address: String(data.address) } : {}),
      ...(has(data.city) ? { city: String(data.city) } : {}),
      ...(has(data.state) ? { state: String(data.state) } : {}),
      ...(has(data.zipCode) ? { zipCode: String(data.zipCode) } : {}),
      ...(has(data.propertyType) ? { propertyType: mapPropertyType(String(data.propertyType)) } : {}),
      ...(has(data.bedrooms) ? { bedrooms: Number(data.bedrooms) } : {}),
      ...(has(data.bathrooms) ? { bathrooms: Number(data.bathrooms) } : {}),
      ...(has(data.sqft) ? { sqft: Number(data.sqft) } : {}),
      ...(data.isOccupied !== undefined && data.isOccupied !== null ? { isOccupied: Boolean(data.isOccupied) } : {}),
      ...(has(data.conditionLevel) ? { conditionLevel: mapConditionLevel(String(data.conditionLevel)) } : {}),
      ...(has(data.preferredSchedule) ? { preferredSchedule: String(data.preferredSchedule) } : {}),
      ...(has(data.language) ? { language: String(data.language).toUpperCase() === "ES" ? "ES" : "EN" } : {}),
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
  if (!env.N8N_WEBHOOK_URL) {
    logger.warn("N8N_WEBHOOK_URL not set — skipping N8N trigger");
    return;
  }

  try {
    const payload = { event, data, timestamp: new Date().toISOString() };
    logger.info({ event, url: env.N8N_WEBHOOK_URL }, "Sending N8N webhook");

    const res = await fetch(env.N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const responseText = await res.text();
    logger.info({ event, status: res.status, response: responseText.slice(0, 500) }, "N8N webhook response");

    if (!res.ok) {
      logger.error({ event, status: res.status, response: responseText.slice(0, 500) }, "N8N webhook returned error");
    }
  } catch (error) {
    logger.error({ error, event, url: env.N8N_WEBHOOK_URL }, "Failed to trigger N8N webhook");
  }
}

async function sendAutoSmsToLead(
  leadId: string,
  outcome: string,
  structured: Record<string, unknown>,
) {
  try {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead?.phone) return;

    // Skip SMS for invalid/test phone numbers
    if (!lead.phone.startsWith("+") || lead.phone === "unknown" || lead.phone.length < 10) {
      logger.info({ leadId, phone: lead.phone }, "Skipping auto SMS — invalid phone number");
      return;
    }

    const hasFullDetails = structured.propertyType && (structured.bedrooms || structured.sqft);
    const isDeepCleaning = String(structured.serviceType || "").toLowerCase().includes("deep");

    let message = "";

    if (outcome === "VOICEMAIL") {
      // Missed call — collect property info
      message = `Hi! Thank you for your call.\nCould you please let me know if the space is a house, apartment, or office, along with the square footage or number of bedrooms and bathrooms?\nAlso, are you looking for a deep cleaning, a one-time standard cleaning, or a recurring service (bi-weekly or monthly)?\nI look forward to your response.`;
    } else if (outcome === "DEPOSIT_REQUESTED" || (outcome === "SCHEDULED" && isDeepCleaning)) {
      // Deep Cleaning — deposit required
      message = `Sunshine – Payment Information\nWe accept Zelle, Venmo, or Cash App.\n\nTo secure your appointment, a $150 deposit is required due to high demand. This deposit reserves your date and is non-negotiable.\nThe remaining balance is due upon completion of the service.\n\nCancellations must be made at least 2 days in advance for a full refund. We're happy to assist with rescheduling if needed.\nThank you for your understanding.`;
    } else if (outcome === "SCHEDULED") {
      // Regular cleaning — payment after service
      message = `Sunshine – Payment Information\nWe accept Zelle, Venmo, or Cash App. Which option works best for you?\n\nPlease note that a $100 cancellation fee applies if the service is canceled within 2 days of the scheduled date. This fee is waived if the service is rescheduled at least 2 days in advance.\nThank you for your understanding.`;
    } else if (hasFullDetails) {
      // All info received — pre-quote confirmation
      message = `Perfect. Thank you for the information.\n\nBased on what you described, I'll prepare your detailed estimate and checklist.\n\nPlease note:\n• For deep cleaning, a deposit is required to secure the appointment due to high demand.\n• Cancellations must be made at least 2 days in advance to avoid fees.\n• Final pricing reflects the actual scope and condition of the property.\n\nI'll send everything shortly.`;
    } else {
      // First contact — full qualification questions
      message = `Hello! Thank you for reaching out to Sunshine.\nI'd be happy to assist you and prepare an accurate quote.\n\nTo make sure we allocate the proper team size, time, and pricing, could you please confirm a few details:\n\n• House, apartment, or office?\n• How many bedrooms and bathrooms?\n• Approximate square footage?\n• Is the property occupied or vacant?\n• Is this move-in, move-out, post-construction, or regular cleaning?\n\nService type:\n• One-time standard cleaning\n• Deep cleaning\n• Recurring service (bi-weekly or monthly)\n\nHow would you describe the condition?\n1. Lightly maintained (routine buildup)\n2. Moderate buildup (visible dirt in kitchen/bathrooms)\n3. Heavily soiled (strong buildup, grease, stains)\n\nOnce I receive this, I'll send your quote and checklist right away.`;
    }

    await smsService.sendMessage({ leadId, body: message });
    logger.info({ leadId, outcome, hasFullDetails }, "Auto SMS sent to lead");
  } catch (error) {
    logger.error({ error, leadId }, "Failed to send auto SMS to lead");
  }
}

async function triggerN8NSms(data: Record<string, unknown>) {
  if (!env.N8N_SMS_WEBHOOK_URL) {
    logger.warn("N8N_SMS_WEBHOOK_URL not set — skipping SMS alert");
    return;
  }

  try {
    const res = await fetch(env.N8N_SMS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "sms_alert", data, timestamp: new Date().toISOString() }),
    });

    const responseText = await res.text();
    logger.info({ status: res.status, response: responseText.slice(0, 500) }, "N8N SMS webhook response");
  } catch (error) {
    logger.error({ error, url: env.N8N_SMS_WEBHOOK_URL }, "Failed to trigger N8N SMS webhook");
  }
}

// ─── Get VAPI assistants ──────────────────────────────────────────────────────

export async function getAssistants() {
  return vapiClient.listAssistants();
}

// ─── OpenAI structured data extraction ────────────────────────────────────────

async function extractStructuredDataWithAI(
  summary: string,
  transcript: string,
): Promise<Record<string, unknown>> {
  if (!env.OPENAI_API_KEY) {
    logger.warn("OPENAI_API_KEY not set — skipping AI extraction");
    return {};
  }

  const text = summary
    ? `CALL SUMMARY:\n${summary}\n\nTRANSCRIPT:\n${transcript.slice(0, 3000)}`
    : `TRANSCRIPT:\n${transcript.slice(0, 4000)}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You extract structured data from cleaning service phone calls. Return a JSON object with ONLY the fields that were clearly mentioned in the conversation. Use null for any field not mentioned — NEVER use empty strings.

Fields to extract:
- firstName (string | null): caller's first name
- lastName (string | null): caller's last name
- address (string | null): property street address
- city (string | null): property city
- state (string | null): state abbreviation (GA, TX, MA, FL, NY)
- zipCode (string | null): zip code
- propertyType (string | null): house, apartment, condo, or office
- bedrooms (integer | null): number of bedrooms
- bathrooms (integer | null): number of bathrooms
- sqft (integer | null): approximate square footage
- isOccupied (boolean | null): whether property is occupied
- conditionLevel (string | null): light, moderate, or heavy
- serviceType (string | null): standard_cleaning, deep_cleaning, recurring, move_in, move_out, or post_construction
- frequency (string | null): one_time, weekly, bi_weekly, or monthly
- preferredSchedule (string | null): preferred days/time
- outcome (string): interested, scheduled, deposit_requested, callback, not_interested, or voicemail
- notes (string | null): any additional notes or special requests
- summary (string): A clean, concise 2-3 sentence summary of the call. Include: caller name, property details (type, beds/baths, location), service requested, condition level, and outcome. Write in third person, professional tone. Example: "John Smith called about a 3-bed/2-bath house in Atlanta, GA (ZIP 30301). Requested a standard cleaning, property is lightly maintained. Appointment scheduled for Monday at 10 AM."

IMPORTANT RULES:
1. If the caller did NOT provide their name, set firstName and lastName to null (not "").
2. Use the EXACT numbers the caller stated (don't change 2 bedrooms to 3).
3. For outcome: "interested" if caller engaged and provided property details. "not_interested" if they declined or hung up quickly. "voicemail" if no live conversation.
4. Always include the outcome and summary fields — they are required.
5. The summary field must be a clean, human-readable text (no markdown, no bullets, no asterisks).`,
          },
          { role: "user", content: text },
        ],
      }),
    });

    if (!res.ok) {
      logger.error({ status: res.status }, "OpenAI API error");
      return {};
    }

    const json = await res.json() as any;
    const content = json.choices?.[0]?.message?.content;
    if (!content) return {};

    const parsed = JSON.parse(content);
    return parsed;
  } catch (error) {
    logger.error({ error }, "Failed to extract structured data with OpenAI");
    return {};
  }
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
  if (lower === "true") return "INTERESTED";
  if (lower === "false") return "NOT_INTERESTED";
  if (lower.includes("scheduled")) return "SCHEDULED";
  if (lower.includes("success") || lower.includes("interested")) return "INTERESTED";
  if (lower.includes("callback") || lower.includes("later")) return "CALLBACK";
  if (lower.includes("transfer")) return "TRANSFERRED";
  if (lower.includes("voicemail")) return "VOICEMAIL";
  return "NOT_INTERESTED";
}

function mapOutcomeToCrmStage(outcome: string, structured: Record<string, unknown>): string {
  // CRM Funnel: Lead Novo → Sem Telefone → Qualificado → Checklist Enviado → Agendado → Em Execução → Finalizado → Pgto Pendente → Pós-Serviço
  const hasFullDetails = structured.propertyType && (structured.bedrooms || structured.sqft);

  if (outcome === "SCHEDULED") return "SCHEDULED";
  if (outcome === "DEPOSIT_REQUESTED") return "CHECKLIST_SENT";
  if (outcome === "INTERESTED" && hasFullDetails) return "LEAD_QUALIFIED";
  if (outcome === "INTERESTED") return "LEAD_NEW"; // Interested but missing details
  if (outcome === "CALLBACK") return "LEAD_NEW";
  if (outcome === "VOICEMAIL") return "LEAD_NEW";
  return "LEAD_NEW";
}

function buildTags(outcome: string, structured: Record<string, unknown>): string[] {
  const tags: string[] = [];
  const hasFullDetails = structured.propertyType && (structured.bedrooms || structured.sqft);
  const isDeepCleaning = String(structured.serviceType || "").toLowerCase().includes("deep");

  // ── Lead stage tags ──
  if (outcome === "VOICEMAIL" || outcome === "CALLBACK" || outcome === "NOT_INTERESTED") {
    tags.push("lead-new");
  } else if (outcome === "INTERESTED" && !hasFullDetails) {
    tags.push("lead-new");
  } else if (outcome === "INTERESTED" && hasFullDetails) {
    tags.push("lead-qualified");
  } else if (outcome === "SCHEDULED") {
    tags.push("lead-qualified", "scheduled");
  } else if (outcome === "DEPOSIT_REQUESTED") {
    tags.push("lead-qualified", "deposit-required");
  }

  // ── Service type tags ──
  if (isDeepCleaning) {
    tags.push("deep-cleaning", "deposit-required");
  } else if (structured.serviceType) {
    const st = String(structured.serviceType).toLowerCase();
    if (st.includes("standard") || st.includes("move")) tags.push("standard-cleaning");
    if (st.includes("recurring")) tags.push("recurring-client");
  }

  // ── Financial tags ──
  if (!isDeepCleaning && structured.serviceType) {
    tags.push("payment-after-service");
  }

  // ── Channel tag — phone confirmed via call ──
  if (structured.firstName && structured.firstName !== "Unknown") {
    tags.push("channel-sms");
  }

  return [...new Set(tags)]; // deduplicate
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
