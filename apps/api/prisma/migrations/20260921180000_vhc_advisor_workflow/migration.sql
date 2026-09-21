-- AlterEnum
ALTER TYPE "VhcInspectionStatus" RENAME VALUE 'COMPLETE' TO 'RECORDED';
ALTER TYPE "VhcInspectionStatus" ADD VALUE 'CONTACTED';

-- CreateEnum
CREATE TYPE "VhcContactMethod" AS ENUM ('EMAIL', 'PHONE');

-- CreateEnum
CREATE TYPE "VhcItemResponseStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'DEFERRED');

-- AlterTable
ALTER TABLE "vhc_inspections" RENAME COLUMN "completedAt" TO "recordedAt";
ALTER TABLE "vhc_inspections" RENAME COLUMN "completedById" TO "recordedById";
ALTER TABLE "vhc_inspections" ADD COLUMN "videoUrl" TEXT;
ALTER TABLE "vhc_inspections" ADD COLUMN "notifiedServiceAdvisorAt" TIMESTAMP(3);
ALTER TABLE "vhc_inspections" ADD COLUMN "contactedAt" TIMESTAMP(3);
ALTER TABLE "vhc_inspections" ADD COLUMN "contactMethod" "VhcContactMethod";
ALTER TABLE "vhc_inspections" ADD COLUMN "contactNotes" TEXT;

-- AlterTable
ALTER TABLE "vhc_items" ADD COLUMN "response" "VhcItemResponseStatus" NOT NULL DEFAULT 'PENDING';
UPDATE "vhc_items" SET "response" = CASE
  WHEN "approved" = true THEN 'APPROVED'::"VhcItemResponseStatus"
  WHEN "approved" = false THEN 'DECLINED'::"VhcItemResponseStatus"
  ELSE 'PENDING'::"VhcItemResponseStatus"
END;
ALTER TABLE "vhc_items" DROP COLUMN "approved";
