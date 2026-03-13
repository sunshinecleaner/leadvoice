import twilio from "twilio";
import { prisma } from "@leadvoice/database";
import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { AppError } from "../../utils/errors.js";
import type { SendMessageInput, ListMessagesInput } from "./sms.schema.js";

function getTwilioClient() {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
    throw new AppError(500, "Twilio credentials not configured");
  }
  return twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
}

// Template → CRM tags + stage mapping (client FLUXTECHNO spec)
const templateTagMap: Record<string, { tags: string[]; crmStage?: string }> = {
  "checklist-confirmed":   { tags: ["scheduled", "team-briefed"], crmStage: "IN_PROGRESS" },
  "service-finished":      { tags: ["service-completed"], crmStage: "SERVICE_COMPLETED" },
  "payment-followup":      { tags: ["payment-pending"], crmStage: "PAYMENT_PENDING" },
  "payment-deep":          { tags: ["deep-cleaning", "deposit-required"], crmStage: "CHECKLIST_SENT" },
  "payment-first-regular": { tags: ["payment-after-service"], crmStage: "SCHEDULED" },
  "payment-no-deposit":    { tags: ["payment-after-service"] },
  "recommend-recurring":   { tags: ["upsell-regular"], crmStage: "PAID" },
  "referral-request":      { tags: ["referral-request"], crmStage: "PAID" },
  "thank-you":             { tags: ["paid"], crmStage: "PAID" },
};

export async function sendMessage(input: SendMessageInput) {
  const from = env.TWILIO_PHONE_NUMBER;
  if (!from) throw new AppError(500, "Twilio phone number not configured");

  let toPhone: string;
  let leadId: string | null = null;

  if (input.leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: input.leadId } });
    if (!lead) throw new AppError(404, "Lead not found");
    if (!lead.phone) throw new AppError(400, "Lead has no phone number");
    toPhone = lead.phone;
    leadId = lead.id;
  } else if (input.phone) {
    toPhone = input.phone.startsWith("+") ? input.phone : `+${input.phone}`;
    leadId = null;
  } else {
    throw new AppError(400, "Either leadId or phone is required");
  }

  // Create record first
  const message = await prisma.message.create({
    data: {
      leadId,
      direction: "OUTBOUND",
      status: "QUEUED",
      from,
      to: toPhone,
      body: input.body,
    },
  });

  try {
    const client = getTwilioClient();
    const twilioMsg = await client.messages.create({
      body: input.body,
      from,
      to: toPhone,
    });

    const updated = await prisma.message.update({
      where: { id: message.id },
      data: {
        twilioSid: twilioMsg.sid,
        status: "SENT",
        sentAt: new Date(),
      },
      include: { lead: { select: { id: true, firstName: true, lastName: true, phone: true } } },
    });

    // Apply CRM tags + advance stage when sending a template message
    if (leadId && input.templateId && templateTagMap[input.templateId]) {
      const lead = await prisma.lead.findUnique({ where: { id: leadId } });
      if (lead) {
        const mapping = templateTagMap[input.templateId];
        const currentTags = (lead.tags as string[]) || [];
        const newTags = [...new Set([...currentTags, ...mapping.tags])];

        await (prisma.lead.update as any)({
          where: { id: lead.id },
          data: {
            tags: newTags,
            ...(mapping.crmStage ? { crmStage: mapping.crmStage } : {}),
          },
        });
        logger.info({ leadId: lead.id, templateId: input.templateId, tags: mapping.tags, crmStage: mapping.crmStage }, "CRM tags applied via template");
      }
    }

    logger.info({ messageId: updated.id, twilioSid: twilioMsg.sid, to: toPhone }, "SMS sent");
    return updated;
  } catch (error: any) {
    await prisma.message.update({
      where: { id: message.id },
      data: {
        status: "FAILED",
        errorMessage: error.message || "Failed to send SMS",
      },
    });
    logger.error({ error, messageId: message.id }, "Failed to send SMS");
    throw new AppError(500, error.message || "Failed to send SMS via Twilio");
  }
}

export async function listMessages(input: ListMessagesInput) {
  const where: any = {};
  if (input.direction) where.direction = input.direction;
  if (input.leadId) where.leadId = input.leadId;

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where,
      include: { lead: { select: { id: true, firstName: true, lastName: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.message.count({ where }),
  ]);

  return { messages, total, page: input.page, limit: input.limit };
}

export async function getMessagesByLead(leadId: string) {
  return prisma.message.findMany({
    where: { leadId },
    orderBy: { createdAt: "desc" },
    include: { lead: { select: { id: true, firstName: true, lastName: true, phone: true } } },
  });
}

export async function processInboundSms(data: {
  From: string;
  To: string;
  Body: string;
  MessageSid: string;
}) {
  // Try to match lead by phone number
  const phone = data.From;
  const lead = await prisma.lead.findFirst({
    where: { phone: { contains: phone.replace("+1", "").replace("+", "") } },
  });

  const message = await prisma.message.create({
    data: {
      leadId: lead?.id || null,
      direction: "INBOUND",
      status: "RECEIVED",
      from: data.From,
      to: data.To,
      body: data.Body,
      twilioSid: data.MessageSid,
      sentAt: new Date(),
    },
  });

  logger.info(
    { messageId: message.id, from: data.From, leadId: lead?.id, twilioSid: data.MessageSid },
    "Inbound SMS received",
  );

  return message;
}
