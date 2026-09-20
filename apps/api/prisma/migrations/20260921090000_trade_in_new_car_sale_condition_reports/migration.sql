-- AlterEnum
ALTER TYPE "DocumentTemplateType" ADD VALUE 'NEW_CAR_SALE';

-- CreateEnum
CREATE TYPE "SaleModel" AS ENUM ('RETAIL', 'AGENCY');

-- CreateEnum
CREATE TYPE "ConditionCheckStage" AS ENUM ('INITIAL', 'FINAL');

-- CreateEnum
CREATE TYPE "DamageSeverity" AS ENUM ('MINOR', 'MODERATE', 'SEVERE');

-- AlterTable: part_exchange_appraisals — replace the vestigial, never-enforced "dealId" string
-- with proper typed FKs to whichever sale (used-car deal sheet or new-car sale) generated this
-- trade-in (table has 0 rows in every environment this has shipped to, so this is a clean swap).
ALTER TABLE "part_exchange_appraisals" DROP COLUMN "dealId";
ALTER TABLE "part_exchange_appraisals" ADD COLUMN "dealSheetId" TEXT;
ALTER TABLE "part_exchange_appraisals" ADD COLUMN "newCarSaleId" TEXT;

-- CreateTable
CREATE TABLE "new_car_sales" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "status" "DealSheetStatus" NOT NULL DEFAULT 'ACTIVE',
    "saleModel" "SaleModel" NOT NULL DEFAULT 'RETAIL',
    "sellingPrice" DECIMAL(10,2) NOT NULL,
    "agencyCommission" DECIMAL(10,2),
    "pdfUrl" TEXT,
    "invalidatedAt" TIMESTAMP(3),
    "invalidatedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "new_car_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_condition_reports" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "courtesyBookingId" TEXT,
    "jobCardId" TEXT,
    "stage" "ConditionCheckStage" NOT NULL,
    "mileage" INTEGER,
    "notes" TEXT,
    "photoUrls" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_condition_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_damage_markers" (
    "id" TEXT NOT NULL,
    "conditionReportId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "DamageSeverity" NOT NULL DEFAULT 'MINOR',
    "photoUrl" TEXT,

    CONSTRAINT "vehicle_damage_markers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "part_exchange_appraisals_dealSheetId_key" ON "part_exchange_appraisals"("dealSheetId");

-- CreateIndex
CREATE UNIQUE INDEX "part_exchange_appraisals_newCarSaleId_key" ON "part_exchange_appraisals"("newCarSaleId");

-- AddForeignKey
ALTER TABLE "part_exchange_appraisals" ADD CONSTRAINT "part_exchange_appraisals_dealSheetId_fkey" FOREIGN KEY ("dealSheetId") REFERENCES "deal_sheets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_exchange_appraisals" ADD CONSTRAINT "part_exchange_appraisals_newCarSaleId_fkey" FOREIGN KEY ("newCarSaleId") REFERENCES "new_car_sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "new_car_sales" ADD CONSTRAINT "new_car_sales_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "new_car_sales" ADD CONSTRAINT "new_car_sales_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_condition_reports" ADD CONSTRAINT "vehicle_condition_reports_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_condition_reports" ADD CONSTRAINT "vehicle_condition_reports_courtesyBookingId_fkey" FOREIGN KEY ("courtesyBookingId") REFERENCES "courtesy_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_condition_reports" ADD CONSTRAINT "vehicle_condition_reports_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "job_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_damage_markers" ADD CONSTRAINT "vehicle_damage_markers_conditionReportId_fkey" FOREIGN KEY ("conditionReportId") REFERENCES "vehicle_condition_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
