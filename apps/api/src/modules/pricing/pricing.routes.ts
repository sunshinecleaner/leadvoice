import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../auth/auth.middleware.js";
import { prisma } from "@leadvoice/database";

const updateRateSchema = z.object({
  pricePerRoom: z.number().positive(),
});

export async function pricingRoutes(app: FastifyInstance) {
  // GET /api/pricing — list all rates
  app.get("/", { preHandler: [authenticate] }, async (_request, reply) => {
    const rates = await prisma.pricingRate.findMany({
      orderBy: [{ serviceType: "asc" }, { classification: "asc" }],
    });
    return reply.send({ success: true, data: rates });
  });

  // PUT /api/pricing/:id — update a single rate's pricePerRoom
  app.put("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateRateSchema.parse(request.body);

    const rate = await prisma.pricingRate.update({
      where: { id },
      data: { pricePerRoom: body.pricePerRoom },
    });

    return reply.send({ success: true, data: rate });
  });
}
