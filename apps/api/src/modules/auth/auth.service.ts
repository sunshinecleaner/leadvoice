import bcrypt from "bcryptjs";
import { prisma } from "@leadvoice/database";
import { AppError, UnauthorizedError } from "../../utils/errors.js";
import type { RegisterInput, LoginInput } from "./auth.schema.js";

const SALT_ROUNDS = 12;

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError(409, "Email already registered");
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

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

  const valid = await bcrypt.compare(input.password, user.password);
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

export async function updateProfile(id: string, input: { name?: string; email?: string }) {
  if (input.email) {
    const existing = await prisma.user.findFirst({
      where: { email: input.email, id: { not: id } },
    });
    if (existing) {
      throw new AppError(409, "Email already in use");
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.email && { email: input.email }),
    },
    select: { id: true, email: true, name: true, role: true, avatar: true, createdAt: true },
  });

  return user;
}

export async function changePassword(id: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AppError(404, "User not found");
  }

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    throw new UnauthorizedError("Current password is incorrect");
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({
    where: { id },
    data: { password: passwordHash },
  });
}
