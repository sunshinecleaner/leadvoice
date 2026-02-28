import type { FastifyRequest, FastifyReply } from "fastify";
import type { JwtPayload } from "@leadvoice/shared";

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    reply.status(401).send({ success: false, error: "Unauthorized" });
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  await authenticate(request, reply);
  const user = request.user as JwtPayload;
  if (user.role !== "ADMIN") {
    reply.status(403).send({ success: false, error: "Admin access required" });
  }
}

// Augment Fastify types
declare module "fastify" {
  interface FastifyRequest {
    user: JwtPayload;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}
