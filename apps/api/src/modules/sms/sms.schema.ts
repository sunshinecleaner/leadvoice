import { z } from "zod";

export const sendMessageSchema = z.object({
  leadId: z.string().min(1).optional(),
  phone: z.string().min(10).optional(),
  body: z.string().min(1).max(1600),
  templateId: z.string().optional(),
}).refine((data) => data.leadId || data.phone, {
  message: "Either leadId or phone is required",
});

export const sendDirectSmsSchema = z.object({
  phone: z.string().min(10),
  body: z.string().min(1).max(1600),
});

export const listMessagesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  direction: z.enum(["INBOUND", "OUTBOUND"]).optional(),
  leadId: z.string().optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type SendDirectSmsInput = z.infer<typeof sendDirectSmsSchema>;
export type ListMessagesInput = z.infer<typeof listMessagesSchema>;
