-- CreateEnum
CREATE TYPE "ConfigScope" AS ENUM ('GROUP', 'FRANCHISE', 'DEALER');

-- CreateEnum
CREATE TYPE "ActionTriggerPoint" AS ENUM ('USED_VEHICLE_REG_LOOKUP');

-- AlterEnum
ALTER TYPE "DocumentTemplateType" ADD VALUE 'AFTERSALES_INVOICE';

-- AlterTable
ALTER TABLE "dealers" ADD COLUMN     "franchiseId" TEXT;

-- AlterTable
ALTER TABLE "document_templates" ADD COLUMN     "franchiseId" TEXT,
ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "scope" "ConfigScope" NOT NULL DEFAULT 'DEALER',
ALTER COLUMN "dealerId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "primaryColour" TEXT,
    "secondaryColour" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "franchises" (
    "id" TEXT NOT NULL,
    "groupId" TEXT,
    "name" TEXT NOT NULL,
    "brandCode" TEXT,
    "logoUrl" TEXT,
    "primaryColour" TEXT,
    "secondaryColour" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "franchises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aftersales_invoices" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "jobCardId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "labourTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "partsTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "vatAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aftersales_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_card_part_requirements" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "jobCardId" TEXT NOT NULL,
    "partId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_card_part_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_triggers" (
    "id" TEXT NOT NULL,
    "scope" "ConfigScope" NOT NULL DEFAULT 'DEALER',
    "dealerId" TEXT,
    "franchiseId" TEXT,
    "groupId" TEXT,
    "name" TEXT NOT NULL,
    "triggerPoint" "ActionTriggerPoint" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "targetEntity" "IntegrationTargetEntity" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_trigger_mappings" (
    "id" TEXT NOT NULL,
    "actionTriggerId" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "targetField" TEXT NOT NULL,
    "isCustomField" BOOLEAN NOT NULL DEFAULT false,
    "transform" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "action_trigger_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "aftersales_invoices_jobCardId_key" ON "aftersales_invoices"("jobCardId");

-- AddForeignKey
ALTER TABLE "franchises" ADD CONSTRAINT "franchises_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "franchises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aftersales_invoices" ADD CONSTRAINT "aftersales_invoices_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aftersales_invoices" ADD CONSTRAINT "aftersales_invoices_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "job_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_card_part_requirements" ADD CONSTRAINT "job_card_part_requirements_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_card_part_requirements" ADD CONSTRAINT "job_card_part_requirements_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "job_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_card_part_requirements" ADD CONSTRAINT "job_card_part_requirements_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "franchises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_triggers" ADD CONSTRAINT "action_triggers_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_triggers" ADD CONSTRAINT "action_triggers_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "franchises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_triggers" ADD CONSTRAINT "action_triggers_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_trigger_mappings" ADD CONSTRAINT "action_trigger_mappings_actionTriggerId_fkey" FOREIGN KEY ("actionTriggerId") REFERENCES "action_triggers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
