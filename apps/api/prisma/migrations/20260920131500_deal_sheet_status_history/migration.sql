-- A deal sheet that falls through (no signed sale) must be invalidatable so the vehicle can get a
-- new one — so DealSheet is no longer 1:1 with UsedVehicle, and gains a status.
CREATE TYPE "DealSheetStatus" AS ENUM ('ACTIVE', 'SIGNED', 'INVALIDATED');

DROP INDEX "deal_sheets_usedVehicleId_key";

ALTER TABLE "deal_sheets"
  ADD COLUMN "status" "DealSheetStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "invalidatedAt" TIMESTAMP(3),
  ADD COLUMN "invalidatedReason" TEXT;
