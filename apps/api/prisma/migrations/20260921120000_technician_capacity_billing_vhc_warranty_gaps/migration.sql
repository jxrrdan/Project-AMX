-- CreateEnum
CREATE TYPE "JobCategory" AS ENUM ('MECHANICAL', 'EV', 'DIAGNOSTICS', 'BODYSHOP', 'TYRES_AND_ALIGNMENT', 'MOT_TESTING', 'VALETING', 'GENERAL');

-- CreateEnum
CREATE TYPE "JobBillingType" AS ENUM ('RETAIL', 'WARRANTY', 'INTERNAL');

-- CreateEnum
CREATE TYPE "TechnicianAvailabilityStatus" AS ENUM ('AVAILABLE', 'LEAVE', 'SICKNESS', 'TRAINING', 'OFF_SHIFT');

-- CreateEnum
CREATE TYPE "VhcInspectionStatus" AS ENUM ('DRAFT', 'COMPLETE', 'SENT', 'CLOSED');

-- AlterTable
ALTER TABLE "job_cards" ADD COLUMN "category" "JobCategory" NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "job_cards" ADD COLUMN "billingType" "JobBillingType" NOT NULL DEFAULT 'RETAIL';
ALTER TABLE "job_cards" ADD COLUMN "sourceVhcItemId" TEXT;

-- AlterTable
ALTER TABLE "aftersales_invoices" ADD COLUMN "isInternal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "aftersales_invoices" ADD COLUMN "recipient" TEXT;

-- AlterTable
ALTER TABLE "warranty_claims" ADD COLUMN "submittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "vhc_inspections" ADD COLUMN "status" "VhcInspectionStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "vhc_inspections" ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "vhc_inspections" ADD COLUMN "completedById" TEXT;

-- CreateTable
CREATE TABLE "technician_skills" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "JobCategory" NOT NULL,

    CONSTRAINT "technician_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technician_availability" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "TechnicianAvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "availableMinutes" INTEGER NOT NULL DEFAULT 480,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "technician_availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_cards_sourceVhcItemId_key" ON "job_cards"("sourceVhcItemId");

-- CreateIndex
CREATE UNIQUE INDEX "technician_skills_userId_category_key" ON "technician_skills"("userId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "technician_availability_userId_date_key" ON "technician_availability"("userId", "date");

-- AddForeignKey
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_sourceVhcItemId_fkey" FOREIGN KEY ("sourceVhcItemId") REFERENCES "vhc_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_skills" ADD CONSTRAINT "technician_skills_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_skills" ADD CONSTRAINT "technician_skills_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_availability" ADD CONSTRAINT "technician_availability_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "technician_availability" ADD CONSTRAINT "technician_availability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
