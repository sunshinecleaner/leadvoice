-- CreateEnum
CREATE TYPE "PricingServiceType" AS ENUM ('DEEP_CLEAN', 'MONTHLY', 'BIWEEKLY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "PricingClassification" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateTable
CREATE TABLE "pricing_rates" (
    "id" TEXT NOT NULL,
    "serviceType" "PricingServiceType" NOT NULL,
    "classification" "PricingClassification" NOT NULL,
    "pricePerRoom" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pricing_rates_serviceType_classification_key" ON "pricing_rates"("serviceType", "classification");
