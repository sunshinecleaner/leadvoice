-- AlterEnum: LeadSource
ALTER TYPE "LeadSource" ADD VALUE 'INBOUND_CALL';
ALTER TYPE "LeadSource" ADD VALUE 'OUTBOUND_CALL';

-- AlterEnum: CallOutcome
ALTER TYPE "CallOutcome" ADD VALUE 'SCHEDULED';
ALTER TYPE "CallOutcome" ADD VALUE 'DEPOSIT_REQUESTED';

-- AlterEnum: IntegrationType
ALTER TYPE "IntegrationType" ADD VALUE 'GOOGLE_SHEETS';
ALTER TYPE "IntegrationType" ADD VALUE 'N8N';

-- CreateEnum
CREATE TYPE "CrmStage" AS ENUM ('LEAD_NEW', 'LEAD_NO_PHONE', 'LEAD_QUALIFIED', 'CHECKLIST_SENT', 'SCHEDULED', 'IN_PROGRESS', 'SERVICE_COMPLETED', 'PAYMENT_PENDING', 'PAID', 'UPSELL', 'REFERRAL_REQUESTED');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('EN', 'ES');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('HOUSE', 'APARTMENT', 'CONDO', 'OFFICE', 'OTHER');

-- CreateEnum
CREATE TYPE "ConditionLevel" AS ENUM ('LIGHT', 'MODERATE', 'HEAVY');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('STANDARD_CLEANING', 'DEEP_CLEANING', 'RECURRING', 'MOVE_IN', 'MOVE_OUT', 'POST_CONSTRUCTION');

-- CreateEnum
CREATE TYPE "ServiceFrequency" AS ENUM ('ONE_TIME', 'WEEKLY', 'BI_WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('ZELLE', 'VENMO', 'CASH_APP', 'PAYPAL', 'CASH');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'DEPOSIT_PAID', 'PAID', 'PARTIAL', 'REFUNDED');

-- AlterTable: leads
ALTER TABLE "leads"
  ADD COLUMN "crmStage"          "CrmStage"      NOT NULL DEFAULT 'LEAD_NEW',
  ADD COLUMN "language"          "Language"      NOT NULL DEFAULT 'EN',
  ADD COLUMN "address"           TEXT,
  ADD COLUMN "city"              TEXT,
  ADD COLUMN "state"             TEXT,
  ADD COLUMN "zipCode"           TEXT,
  ADD COLUMN "propertyType"      "PropertyType",
  ADD COLUMN "bedrooms"          INTEGER,
  ADD COLUMN "bathrooms"         INTEGER,
  ADD COLUMN "sqft"              INTEGER,
  ADD COLUMN "isOccupied"        BOOLEAN,
  ADD COLUMN "conditionLevel"    "ConditionLevel",
  ADD COLUMN "preferredSchedule" TEXT;

-- AlterTable: calls
ALTER TABLE "calls"
  ADD COLUMN "vapiCallId" TEXT,
  ADD COLUMN "summary"    TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "calls_vapiCallId_key" ON "calls"("vapiCallId");

-- CreateIndex
CREATE INDEX "leads_crmStage_idx" ON "leads"("crmStage");

-- CreateIndex
CREATE INDEX "calls_vapiCallId_idx" ON "calls"("vapiCallId");

-- CreateTable: service_requests
CREATE TABLE "service_requests" (
  "id"              TEXT         NOT NULL,
  "leadId"          TEXT         NOT NULL,
  "serviceType"     "ServiceType" NOT NULL,
  "frequency"       "ServiceFrequency" NOT NULL DEFAULT 'ONE_TIME',
  "addOns"          TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
  "checklistSent"   BOOLEAN      NOT NULL DEFAULT false,
  "scheduledDate"   TIMESTAMP(3),
  "notes"           TEXT,
  "estimatedAmount" DOUBLE PRECISION,
  "totalAmount"     DOUBLE PRECISION,
  "depositRequired" BOOLEAN      NOT NULL DEFAULT false,
  "depositAmount"   DOUBLE PRECISION,
  "depositPaid"     BOOLEAN      NOT NULL DEFAULT false,
  "paymentMethod"   "PaymentMethod",
  "paymentStatus"   "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "paidAt"          TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_requests_leadId_idx" ON "service_requests"("leadId");
CREATE INDEX "service_requests_serviceType_idx" ON "service_requests"("serviceType");
CREATE INDEX "service_requests_paymentStatus_idx" ON "service_requests"("paymentStatus");

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
