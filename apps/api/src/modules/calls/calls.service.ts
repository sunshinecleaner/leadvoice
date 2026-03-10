import { prisma, Prisma } from "@leadvoice/database";
import type { PaginationParams } from "@leadvoice/shared";
import { paginationMeta } from "../../utils/helpers.js";
import { NotFoundError } from "../../utils/errors.js";

export async function getCalls(params: PaginationParams, filters?: { status?: string; direction?: string; leadId?: string }) {
  const where: Prisma.CallWhereInput = {};

  if (filters?.status) {
    where.status = filters.status as any;
  }
  if (filters?.direction) {
    where.direction = filters.direction as any;
  }
  if (filters?.leadId) {
    where.leadId = filters.leadId;
  }

  const [data, total] = await Promise.all([
    prisma.call.findMany({
      where,
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (params.page - 1) * params.limit,
      take: params.limit,
    }),
    prisma.call.count({ where }),
  ]);

  return { data, meta: paginationMeta(total, params.page, params.limit) };
}

export async function getCallById(id: string) {
  const call = await prisma.call.findUnique({
    where: { id },
    include: {
      lead: { select: { id: true, firstName: true, lastName: true, phone: true, city: true, state: true } },
      events: { orderBy: { timestamp: "asc" } },
    },
  });

  if (!call) throw new NotFoundError("Call");
  return call;
}
