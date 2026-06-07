-- CreateEnum
CREATE TYPE "CashFlowType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "birthDate" TIMESTAMP(3),
    "emergencyContact" TEXT,
    "costPerClean" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_flows" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "CashFlowType" NOT NULL,
    "paymentMethod" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_flows_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "service_requests" ADD COLUMN "teamMemberId" TEXT;

-- CreateIndex
CREATE INDEX "cash_flows_date_idx" ON "cash_flows"("date");

-- CreateIndex
CREATE INDEX "cash_flows_type_idx" ON "cash_flows"("type");

-- CreateIndex
CREATE INDEX "service_requests_teamMemberId_idx" ON "service_requests"("teamMemberId");

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
