-- CreateEnum
CREATE TYPE "NominalAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "VatCode" AS ENUM ('STANDARD', 'REDUCED', 'ZERO', 'EXEMPT', 'OUTSIDE_SCOPE');

-- CreateEnum
CREATE TYPE "JournalSourceType" AS ENUM ('AFTERSALES_INVOICE', 'CUSTOMER_INVOICE', 'SUPPLIER_INVOICE', 'MANUFACTURER_PAYMENT', 'VEHICLE_SALE', 'MANUAL');

-- CreateEnum
CREATE TYPE "SupplierInvoiceStatus" AS ENUM ('DRAFT', 'MATCHED', 'DISCREPANCY', 'APPROVED', 'PAID');

-- CreateEnum
CREATE TYPE "ManufacturerPaymentBatchStatus" AS ENUM ('RECEIVED', 'RECONCILED', 'DISCREPANCY', 'POSTED');

-- CreateEnum
CREATE TYPE "VatReturnStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateTable
CREATE TABLE "nominal_accounts" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "NominalAccountType" NOT NULL,
    "defaultVatCode" "VatCode",
    "isControlAccount" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nominal_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "sourceType" "JournalSourceType" NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatCode" "VatCode",
    "vatAmount" DECIMAL(12,2),
    "description" TEXT,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountNumber" TEXT,
    "vatNumber" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isManufacturer" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_notes" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "grnNumber" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goods_receipt_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goods_receipt_lines" (
    "id" TEXT NOT NULL,
    "goodsReceiptNoteId" TEXT NOT NULL,
    "purchaseOrderLineId" TEXT NOT NULL,
    "quantityReceived" INTEGER NOT NULL,

    CONSTRAINT "goods_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_invoices" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchaseOrderId" TEXT,
    "goodsReceiptNoteId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" DATE NOT NULL,
    "netAmount" DECIMAL(10,2) NOT NULL,
    "vatAmount" DECIMAL(10,2) NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "status" "SupplierInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "matchDiscrepancy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_invoice_lines" (
    "id" TEXT NOT NULL,
    "supplierInvoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "netAmount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "supplier_invoice_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manufacturer_payment_batches" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "batchReference" TEXT NOT NULL,
    "isSelfBill" BOOLEAN NOT NULL DEFAULT true,
    "remittanceUrl" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "status" "ManufacturerPaymentBatchStatus" NOT NULL DEFAULT 'RECEIVED',
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manufacturer_payment_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manufacturer_payment_batch_lines" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "warrantyClaimId" TEXT,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "discrepancy" DECIMAL(10,2),

    CONSTRAINT "manufacturer_payment_batch_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vat_returns" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "box1VatDueSales" DECIMAL(12,2) NOT NULL,
    "box2VatDueAcquisitions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "box3TotalVatDue" DECIMAL(12,2) NOT NULL,
    "box4VatReclaimed" DECIMAL(12,2) NOT NULL,
    "box5NetVatDue" DECIMAL(12,2) NOT NULL,
    "box6TotalSalesExVat" DECIMAL(12,2) NOT NULL,
    "box7TotalPurchasesExVat" DECIMAL(12,2) NOT NULL,
    "box8TotalSuppliesExVat" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "box9TotalAcquisitionsExVat" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "VatReturnStatus" NOT NULL DEFAULT 'DRAFT',
    "hmrcSubmissionRef" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vat_returns_pkey" PRIMARY KEY ("id")
);

-- AlterTable: purchase_orders — replace the free-text supplier name with a proper Supplier relation
-- (table has 0 rows in every environment this has shipped to, so this is a clean swap).
ALTER TABLE "purchase_orders" DROP COLUMN "supplier";
ALTER TABLE "purchase_orders" ADD COLUMN "supplierId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "nominal_accounts_dealerId_code_key" ON "nominal_accounts"("dealerId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_dealerId_name_key" ON "suppliers"("dealerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_invoices_dealerId_supplierId_invoiceNumber_key" ON "supplier_invoices"("dealerId", "supplierId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "vat_returns_dealerId_periodStart_periodEnd_key" ON "vat_returns"("dealerId", "periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "nominal_accounts" ADD CONSTRAINT "nominal_accounts_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "nominal_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_notes" ADD CONSTRAINT "goods_receipt_notes_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_notes" ADD CONSTRAINT "goods_receipt_notes_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_notes" ADD CONSTRAINT "goods_receipt_notes_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_goodsReceiptNoteId_fkey" FOREIGN KEY ("goodsReceiptNoteId") REFERENCES "goods_receipt_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_purchaseOrderLineId_fkey" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "purchase_order_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_goodsReceiptNoteId_fkey" FOREIGN KEY ("goodsReceiptNoteId") REFERENCES "goods_receipt_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_supplierInvoiceId_fkey" FOREIGN KEY ("supplierInvoiceId") REFERENCES "supplier_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturer_payment_batches" ADD CONSTRAINT "manufacturer_payment_batches_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturer_payment_batches" ADD CONSTRAINT "manufacturer_payment_batches_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturer_payment_batch_lines" ADD CONSTRAINT "manufacturer_payment_batch_lines_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "manufacturer_payment_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manufacturer_payment_batch_lines" ADD CONSTRAINT "manufacturer_payment_batch_lines_warrantyClaimId_fkey" FOREIGN KEY ("warrantyClaimId") REFERENCES "warranty_claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vat_returns" ADD CONSTRAINT "vat_returns_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
