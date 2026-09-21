-- CreateEnum
CREATE TYPE "BatchJobStatus" AS ENUM ('RUNNING', 'SUCCESS', 'ERROR');

-- AlterEnum
ALTER TYPE "DocumentTemplateType" ADD VALUE 'DEAL_SHEET';

-- AlterTable
ALTER TABLE "dealers" ADD COLUMN     "invoiceFooterNote" TEXT,
ADD COLUMN     "secondaryColour" TEXT DEFAULT '#1C69D4',
ADD COLUMN     "vatNumber" TEXT;

-- AlterTable
ALTER TABLE "document_templates" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "batch_job_runs" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "status" "BatchJobStatus" NOT NULL DEFAULT 'RUNNING',
    "summary" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "batch_job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "batch_job_runs_dealerId_jobName_startedAt_idx" ON "batch_job_runs"("dealerId", "jobName", "startedAt");

-- AddForeignKey
ALTER TABLE "batch_job_runs" ADD CONSTRAINT "batch_job_runs_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
