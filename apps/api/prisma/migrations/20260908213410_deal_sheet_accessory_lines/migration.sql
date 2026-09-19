/*
  Warnings:

  - Made the column `accessoriesTotal` on table `deal_sheets` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "deal_sheets" ALTER COLUMN "accessoriesTotal" SET NOT NULL,
ALTER COLUMN "accessoriesTotal" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "deal_accessory_lines" (
    "id" TEXT NOT NULL,
    "dealSheetId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "deal_accessory_lines_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "deal_accessory_lines" ADD CONSTRAINT "deal_accessory_lines_dealSheetId_fkey" FOREIGN KEY ("dealSheetId") REFERENCES "deal_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
