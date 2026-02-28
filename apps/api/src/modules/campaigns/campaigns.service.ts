import { prisma, CampaignStatus, Prisma } from "@leadvoice/database";
import type { PaginationParams } from "@leadvoice/shared";
import { paginationMeta } from "../../utils/helpers.js";
import { NotFoundError, AppError } from "../../utils/errors.js";
import type { CreateCampaignInput, UpdateCampaignInput } from "./campaigns.schema.js";

export async function getCampaigns(params: PaginationParams) {
  const where: Prisma.CampaignWhereInput = {};

  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: "insensitive" } },
      { description: { contains: params.search, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.campaign.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { campaignLeads: true } },
      },
      orderBy: { [params.sortBy || "createdAt"]: params.sortOrder || "desc" },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
    prisma.campaign.count({ where }),
  ]);

  return { data, meta: paginationMeta(total, params.page, params.limit) };
}

export async function getCampaignById(id: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true } },
      campaignLeads: {
        include: {
          lead: { select: { id: true, firstName: true, lastName: true, phone: true, status: true } },
        },
        orderBy: { status: "asc" },
      },
    },
  });

  if (!campaign) throw new NotFoundError("Campaign");
  return campaign;
}

export async function createCampaign(input: CreateCampaignInput, userId: string) {
  return prisma.campaign.create({
    data: { ...input, createdById: userId },
    include: { createdBy: { select: { id: true, name: true } } },
  });
}

export async function updateCampaign(id: string, input: UpdateCampaignInput) {
  await getCampaignById(id);
  return prisma.campaign.update({
    where: { id },
    data: input,
    include: { createdBy: { select: { id: true, name: true } } },
  });
}

export async function deleteCampaign(id: string) {
  await getCampaignById(id);
  return prisma.campaign.delete({ where: { id } });
}

export async function startCampaign(id: string) {
  const campaign = await getCampaignById(id);
  if (campaign.status === CampaignStatus.ACTIVE) {
    throw new AppError(400, "Campaign is already active");
  }
  return prisma.campaign.update({
    where: { id },
    data: { status: CampaignStatus.ACTIVE },
  });
}

export async function pauseCampaign(id: string) {
  const campaign = await getCampaignById(id);
  if (campaign.status !== CampaignStatus.ACTIVE) {
    throw new AppError(400, "Campaign is not active");
  }
  return prisma.campaign.update({
    where: { id },
    data: { status: CampaignStatus.PAUSED },
  });
}

export async function addLeadsToCampaign(campaignId: string, leadIds: string[]) {
  await getCampaignById(campaignId);

  const data = leadIds.map((leadId) => ({
    campaignId,
    leadId,
  }));

  const result = await prisma.campaignLead.createMany({
    data,
    skipDuplicates: true,
  });

  return { added: result.count };
}
