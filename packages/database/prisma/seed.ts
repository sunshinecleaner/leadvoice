import { PrismaClient, UserRole, PricingServiceType, PricingClassification } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@leadvoice.com" },
    update: {},
    create: {
      email: "admin@leadvoice.com",
      name: "Welica Nunes",
      password: passwordHash,
      role: UserRole.ADMIN,
    },
  });

  // Pricing rates — price per room, before 18% margin
  // Total = rooms × pricePerRoom × 1.18
  const pricingDefaults: Array<{ serviceType: PricingServiceType; classification: PricingClassification; pricePerRoom: number }> = [
    { serviceType: PricingServiceType.DEEP_CLEAN, classification: PricingClassification.EASY,   pricePerRoom: 120 },
    { serviceType: PricingServiceType.DEEP_CLEAN, classification: PricingClassification.MEDIUM,  pricePerRoom: 95  },
    { serviceType: PricingServiceType.DEEP_CLEAN, classification: PricingClassification.HARD,    pricePerRoom: 80  },
    { serviceType: PricingServiceType.MONTHLY,    classification: PricingClassification.EASY,   pricePerRoom: 80  },
    { serviceType: PricingServiceType.MONTHLY,    classification: PricingClassification.MEDIUM,  pricePerRoom: 60  },
    { serviceType: PricingServiceType.MONTHLY,    classification: PricingClassification.HARD,    pricePerRoom: 53  },
    { serviceType: PricingServiceType.BIWEEKLY,   classification: PricingClassification.EASY,   pricePerRoom: 60  },
    { serviceType: PricingServiceType.BIWEEKLY,   classification: PricingClassification.MEDIUM,  pricePerRoom: 45  },
    { serviceType: PricingServiceType.BIWEEKLY,   classification: PricingClassification.HARD,    pricePerRoom: 40  },
    { serviceType: PricingServiceType.WEEKLY,     classification: PricingClassification.EASY,   pricePerRoom: 50  },
    { serviceType: PricingServiceType.WEEKLY,     classification: PricingClassification.MEDIUM,  pricePerRoom: 37  },
    { serviceType: PricingServiceType.WEEKLY,     classification: PricingClassification.HARD,    pricePerRoom: 33  },
  ];

  for (const rate of pricingDefaults) {
    await prisma.pricingRate.upsert({
      where: { serviceType_classification: { serviceType: rate.serviceType, classification: rate.classification } },
      update: {},
      create: rate,
    });
  }

  console.log("Seed completed:", { admin: admin.email, pricingRates: pricingDefaults.length });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
