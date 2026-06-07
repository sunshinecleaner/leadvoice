import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../auth/auth.middleware.js";
import { prisma } from "@leadvoice/database";

const createSchema = z.object({
  date: z.string().datetime(),
  description: z.string().min(1),
  category: z.string().min(1),
  amount: z.number().positive(),
  type: z.enum(["INCOME", "EXPENSE"]),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
});

const updateSchema = createSchema.partial();

export async function cashflowRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authenticate] }, async (request, reply) => {
    const { month, year } = request.query as { month?: string; year?: string };

    const where: any = {};
    if (month && year) {
      const start = new Date(Number(year), Number(month) - 1, 1);
      const end = new Date(Number(year), Number(month), 1);
      where.date = { gte: start, lt: end };
    }

    const [entries, totals] = await Promise.all([
      prisma.cashFlow.findMany({ where, orderBy: { date: "desc" } }),
      prisma.cashFlow.groupBy({
        by: ["type"],
        where,
        _sum: { amount: true },
      }),
    ]);

    const income = totals.find((t) => t.type === "INCOME")?._sum.amount ?? 0;
    const expense = totals.find((t) => t.type === "EXPENSE")?._sum.amount ?? 0;

    return reply.send({
      success: true,
      data: { entries, summary: { income, expense, net: income - expense } },
    });
  });

  app.post("/", { preHandler: [authenticate] }, async (request, reply) => {
    const body = createSchema.parse(request.body);
    const entry = await prisma.cashFlow.create({
      data: { ...body, date: new Date(body.date) },
    });
    return reply.status(201).send({ success: true, data: entry });
  });

  app.put("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateSchema.parse(request.body);
    const entry = await prisma.cashFlow.update({
      where: { id },
      data: { ...body, date: body.date ? new Date(body.date) : undefined },
    });
    return reply.send({ success: true, data: entry });
  });

  app.delete("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.cashFlow.delete({ where: { id } });
    return reply.send({ success: true });
  });
}
