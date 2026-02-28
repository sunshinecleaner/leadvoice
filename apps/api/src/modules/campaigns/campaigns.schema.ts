import { z } from "zod";

export const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  script: z.string().min(1),
  voiceId: z.string().optional(),
  maxRetries: z.number().min(0).max(10).default(3),
  retryDelayMinutes: z.number().min(1).max(1440).default(60),
  callingWindowStart: z.string().default("09:00"),
  callingWindowEnd: z.string().default("17:00"),
  timezone: z.string().default("America/New_York"),
});

export const updateCampaignSchema = createCampaignSchema.partial();

export const addLeadsToCampaignSchema = z.object({
  leadIds: z.array(z.string()).min(1),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
