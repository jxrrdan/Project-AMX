-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'BANK_TRANSFER', 'CASH');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentSourceType" AS ENUM ('AFTERSALES_INVOICE', 'CUSTOMER_INVOICE');

-- CreateEnum
CREATE TYPE "CallDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "CallOutcome" AS ENUM ('CONNECTED', 'NO_ANSWER', 'VOICEMAIL', 'WRONG_NUMBER');

-- CreateEnum
CREATE TYPE "BankLineStatus" AS ENUM ('UNMATCHED', 'MATCHED');

-- AlterEnum
ALTER TYPE "NotificationChannel" ADD VALUE 'WHATSAPP';

-- AlterTable
ALTER TABLE "aftersales_invoices" ADD COLUMN     "paidAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "customer_invoices" ADD COLUMN     "paidAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "sourceType" "PaymentSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "providerRef" TEXT,
    "failureReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "SmsStatus" NOT NULL DEFAULT 'QUEUED',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_logs" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "direction" "CallDirection" NOT NULL,
    "outcome" "CallOutcome" NOT NULL,
    "notes" TEXT,
    "loggedById" TEXT,
    "calledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_statement_lines" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "BankLineStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchedJournalLineId" TEXT,
    "importBatchRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_statement_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bank_statement_lines_matchedJournalLineId_key" ON "bank_statement_lines"("matchedJournalLineId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_matchedJournalLineId_fkey" FOREIGN KEY ("matchedJournalLineId") REFERENCES "journal_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
