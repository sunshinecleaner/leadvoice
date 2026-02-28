import { z } from "zod";

export const createLeadSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().min(5).max(20),
  email: z.string().email().optional(),
  company: z.string().max(200).optional(),
  source: z.enum(["CSV", "API", "CRM", "LANDING_PAGE", "MANUAL"]).default("MANUAL"),
  timezone: z.string().optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  assignedToId: z.string().optional(),
});

export const updateLeadSchema = createLeadSchema.partial().extend({
  status: z.enum(["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"]).optional(),
  score: z.number().min(0).max(100).optional(),
});

export const bulkAssignSchema = z.object({
  leadIds: z.array(z.string()).min(1),
  assignedToId: z.string(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
