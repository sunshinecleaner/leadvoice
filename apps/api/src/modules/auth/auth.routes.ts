import type { FastifyInstance } from "fastify";
import { registerSchema, loginSchema } from "./auth.schema.js";
import { registerUser, loginUser, getUserById } from "./auth.service.js";
import { authenticate } from "./auth.middleware.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const user = await registerUser(body);
    const token = app.jwt.sign({ userId: user.id, email: user.email, role: user.role });

    return reply.status(201).send({
      success: true,
      data: { user, token },
    });
  });

  app.post("/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await loginUser(body);
    const token = app.jwt.sign({ userId: user.id, email: user.email, role: user.role });

    return reply.send({
      success: true,
      data: { user, token },
    });
  });

  app.get("/me", { preHandler: [authenticate] }, async (request, reply) => {
    const user = await getUserById(request.user.userId);
    if (!user) {
      return reply.status(404).send({ success: false, error: "User not found" });
    }

    return reply.send({ success: true, data: user });
  });

  app.post("/refresh", { preHandler: [authenticate] }, async (request, reply) => {
    const { userId, email, role } = request.user;
    const token = app.jwt.sign({ userId, email, role });

    return reply.send({ success: true, data: { token } });
  });
}
