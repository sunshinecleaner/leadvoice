import { hash, compare } from "bcrypt";
import { prisma } from "@leadvoice/database";
import { AppError, UnauthorizedError } from "../../utils/errors.js";
import type { RegisterInput, LoginInput } from "./auth.schema.js";

const SALT_ROUNDS = 12;

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError(409, "Email already registered");
  }

  const passwordHash = await hash(input.password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      password: passwordHash,
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  return user;
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.active) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const valid = await compare(input.password, user.password);
  if (!valid) {
    throw new UnauthorizedError("Invalid credentials");
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, avatar: true, createdAt: true },
  });

  return user;
}
