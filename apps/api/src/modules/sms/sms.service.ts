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

export async function sendMessage(input: SendMessageInput) {
  const lead = await prisma.lead.findUnique({ where: { id: input.leadId } });
  if (!lead) throw new AppError(404, "Lead not found");
  if (!lead.phone) throw new AppError(400, "Lead has no phone number");

  const from = env.TWILIO_PHONE_NUMBER;
  if (!from) throw new AppError(500, "Twilio phone number not configured");

  // Create record first
  const message = await prisma.message.create({
    data: {
      leadId: lead.id,
      direction: "OUTBOUND",
      status: "QUEUED",
      from,
      to: lead.phone,
      body: input.body,
    },
  });

  try {
    const client = getTwilioClient();
    const twilioMsg = await client.messages.create({
      body: input.body,
      from,
      to: lead.phone,
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

    logger.info({ messageId: updated.id, twilioSid: twilioMsg.sid, to: lead.phone }, "SMS sent");
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
