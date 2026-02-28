import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@leadvoice.com" },
    update: {},
    create: {
      email: "admin@leadvoice.com",
      name: "Admin",
      password: passwordHash,
      role: UserRole.ADMIN,
    },
  });

  console.log("Seed completed:", { admin: admin.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
