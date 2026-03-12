import { prisma, Prisma } from "@leadvoice/database";
import type { PaginationParams } from "@leadvoice/shared";
import { paginationMeta } from "../../utils/helpers.js";
import { NotFoundError } from "../../utils/errors.js";
import type { CreateLeadInput, UpdateLeadInput } from "./leads.schema.js";
import * as googleCalendarService from "../google-calendar/google-calendar.service.js";
import { logger } from "../../lib/logger.js";

export async function getLeads(params: PaginationParams, filters?: { status?: string; source?: string }) {
  const where: Prisma.LeadWhereInput = {};

  if (params.search) {
    where.OR = [
      { firstName: { contains: params.search, mode: "insensitive" } },
      { lastName: { contains: params.search, mode: "insensitive" } },
      { email: { contains: params.search, mode: "insensitive" } },
      { phone: { contains: params.search } },
      { company: { contains: params.search, mode: "insensitive" } },
    ];
  }

  if (filters?.status) {
    where.status = filters.status as any;
  }
  if (filters?.source) {
    where.source = filters.source as any;
  }

  const [data, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: { assignedTo: { select: { id: true, name: true, email: true } } },
      orderBy: { [params.sortBy || "createdAt"]: params.sortOrder || "desc" },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
    prisma.lead.count({ where }),
  ]);

  return { data, meta: paginationMeta(total, params.page, params.limit) };
}

export async function getLeadById(id: string) {
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      calls: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          direction: true,
          status: true,
          duration: true,
          outcome: true,
          summary: true,
          transcription: true,
          recordingUrl: true,
          createdAt: true,
        },
      },
      serviceRequests: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      campaignLeads: {
        include: { campaign: { select: { id: true, name: true, status: true } } },
      },
    },
  });

  if (!lead) throw new NotFoundError("Lead");
  return lead;
}

export async function createLead(input: CreateLeadInput) {
  return prisma.lead.create({
    data: input,
    include: { assignedTo: { select: { id: true, name: true, email: true } } },
  });
}

export async function updateLead(id: string, input: UpdateLeadInput) {
  const existing = await getLeadById(id);
  const updated = await prisma.lead.update({
    where: { id },
    data: input,
    include: { assignedTo: { select: { id: true, name: true, email: true } } },
  });

  // When crmStage transitions to SCHEDULED, create a Google Calendar event for the most recent service request
  const inputAny = input as any;
  if (inputAny.crmStage === "SCHEDULED" && existing.crmStage !== "SCHEDULED") {
    const latestSr = await prisma.serviceRequest.findFirst({
      where: { leadId: id },
      orderBy: { createdAt: "desc" },
    });
    if (latestSr) {
      googleCalendarService.createEventForServiceRequest(latestSr.id).catch((err) =>
        logger.warn({ err, leadId: id, serviceRequestId: latestSr.id }, "Failed to create Google Calendar event for scheduled lead")
      );
    }
  }

  return updated;
}

export async function deleteLead(id: string) {
  await getLeadById(id);
  return prisma.lead.delete({ where: { id } });
}

export async function bulkAssignLeads(leadIds: string[], assignedToId: string) {
  return prisma.lead.updateMany({
    where: { id: { in: leadIds } },
    data: { assignedToId },
  });
}
