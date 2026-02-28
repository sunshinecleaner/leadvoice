import { prisma, CampaignStatus, CallStatus } from "@leadvoice/database";
import type { DashboardStats } from "@leadvoice/shared";

export async function getStats(): Promise<DashboardStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [totalLeads, totalCalls, activeCampaigns, convertedLeads, callsToday, avgDuration] =
    await Promise.all([
      prisma.lead.count(),
      prisma.call.count(),
      prisma.campaign.count({ where: { status: CampaignStatus.ACTIVE } }),
      prisma.lead.count({ where: { status: "CONVERTED" } }),
      prisma.call.count({ where: { createdAt: { gte: today } } }),
      prisma.call.aggregate({
        _avg: { duration: true },
        where: { status: CallStatus.COMPLETED },
      }),
    ]);

  return {
    totalLeads,
    totalCalls,
    activeCampaigns,
    conversionRate: totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0,
    avgCallDuration: avgDuration._avg.duration || 0,
    callsToday,
  };
}

export async function getChartData() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const calls = await prisma.call.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { createdAt: true, status: true, outcome: true, duration: true },
    orderBy: { createdAt: "asc" },
  });

  const leadsByStatus = await prisma.lead.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const leadsBySource = await prisma.lead.groupBy({
    by: ["source"],
    _count: { _all: true },
  });

  return {
    calls,
    leadsByStatus: leadsByStatus.map((g) => ({ status: g.status, count: g._count._all })),
    leadsBySource: leadsBySource.map((g) => ({ source: g.source, count: g._count._all })),
  };
}
