import type { FastifyInstance } from "fastify";
import { authenticate } from "../auth/auth.middleware.js";
import { prisma } from "@leadvoice/database";

const FREQUENCY_MULTIPLIER: Record<string, number> = {
  WEEKLY: 4,
  BI_WEEKLY: 2,
  MONTHLY: 1,
};

export async function clientsRoutes(app: FastifyInstance) {
  // Active recurring clients (frequency != ONE_TIME)
  app.get("/", { preHandler: [authenticate] }, async (_req, reply) => {
    const clients = await prisma.lead.findMany({
      where: {
        serviceRequests: {
          some: { frequency: { not: "ONE_TIME" } },
        },
      },
      include: {
        serviceRequests: {
          where: { frequency: { not: "ONE_TIME" } },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { teamMember: true },
        },
      },
      orderBy: { firstName: "asc" },
    });

    const data = clients.map((lead) => {
      const sr = lead.serviceRequests[0];
      return {
        id: lead.id,
        name: `${lead.firstName} ${lead.lastName}`,
        phone: lead.phone,
        email: lead.email,
        address: lead.address,
        city: lead.city,
        state: lead.state,
        frequency: sr?.frequency,
        serviceType: sr?.serviceType,
        estimatedAmount: sr?.estimatedAmount,
        scheduledDate: sr?.scheduledDate,
        teamMember: sr?.teamMember ?? null,
        paymentStatus: sr?.paymentStatus,
      };
    });

    return reply.send({ success: true, data });
  });

  // Billing report grouped by frequency
  app.get("/billing", { preHandler: [authenticate] }, async (_req, reply) => {
    const serviceRequests = await prisma.serviceRequest.findMany({
      where: { frequency: { not: "ONE_TIME" } },
      include: {
        lead: { select: { firstName: true, lastName: true, phone: true } },
        teamMember: { select: { name: true, costPerClean: true } },
      },
      orderBy: { frequency: "asc" },
    });

    const groups: Record<string, any[]> = { WEEKLY: [], BI_WEEKLY: [], MONTHLY: [] };

    for (const sr of serviceRequests) {
      const freq = sr.frequency as string;
      if (!groups[freq]) continue;
      const multiplier = FREQUENCY_MULTIPLIER[freq] ?? 1;
      const value = sr.estimatedAmount ?? 0;
      const teamCost = sr.teamMember?.costPerClean ?? 0;
      const otherExpenses = value * 0.1;

      groups[freq].push({
        leadName: `${sr.lead.firstName} ${sr.lead.lastName}`,
        phone: sr.lead.phone,
        value,
        monthlyRevenue: value * multiplier,
        teamCost: teamCost * multiplier,
        otherExpenses: otherExpenses * multiplier,
        netResult: (value - teamCost - otherExpenses) * multiplier,
        teamMember: sr.teamMember?.name ?? null,
        paymentStatus: sr.paymentStatus,
        scheduledDate: sr.scheduledDate,
      });
    }

    const summary = Object.entries(groups).map(([freq, items]) => ({
      frequency: freq,
      clientCount: items.length,
      totalRevenue: items.reduce((s, i) => s + i.monthlyRevenue, 0),
      totalCost: items.reduce((s, i) => s + i.teamCost + i.otherExpenses, 0),
      netResult: items.reduce((s, i) => s + i.netResult, 0),
      clients: items,
    }));

    const grandTotal = {
      revenue: summary.reduce((s, g) => s + g.totalRevenue, 0),
      cost: summary.reduce((s, g) => s + g.totalCost, 0),
      net: summary.reduce((s, g) => s + g.netResult, 0),
    };

    return reply.send({ success: true, data: { groups: summary, grandTotal } });
  });
}
