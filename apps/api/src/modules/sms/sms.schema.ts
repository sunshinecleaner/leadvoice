import { z } from "zod";

export const sendMessageSchema = z.object({
  leadId: z.string().min(1),
  body: z.string().min(1).max(1600),
});

export const listMessagesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  direction: z.enum(["INBOUND", "OUTBOUND"]).optional(),
  leadId: z.string().optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ListMessagesInput = z.infer<typeof listMessagesSchema>;
