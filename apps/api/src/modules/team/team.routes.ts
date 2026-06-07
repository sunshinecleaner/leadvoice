import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../auth/auth.middleware.js";
import { prisma } from "@leadvoice/database";

const createSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  birthDate: z.string().datetime().optional(),
  emergencyContact: z.string().optional(),
  costPerClean: z.number().positive().optional(),
});

const updateSchema = createSchema.partial().extend({
  active: z.boolean().optional(),
});

export async function teamRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [authenticate] }, async (_req, reply) => {
    const members = await prisma.teamMember.findMany({
      orderBy: { name: "asc" },
    });
    return reply.send({ success: true, data: members });
  });

  app.post("/", { preHandler: [authenticate] }, async (request, reply) => {
    const body = createSchema.parse(request.body);
    const member = await prisma.teamMember.create({
      data: {
        ...body,
        birthDate: body.birthDate ? new Date(body.birthDate) : undefined,
      },
    });
    return reply.status(201).send({ success: true, data: member });
  });

  app.put("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateSchema.parse(request.body);
    const member = await prisma.teamMember.update({
      where: { id },
      data: {
        ...body,
        birthDate: body.birthDate ? new Date(body.birthDate) : undefined,
      },
    });
    return reply.send({ success: true, data: member });
  });

  app.delete("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await prisma.teamMember.update({ where: { id }, data: { active: false } });
    return reply.send({ success: true });
  });
}
