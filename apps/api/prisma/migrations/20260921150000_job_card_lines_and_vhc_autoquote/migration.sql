-- AlterTable
ALTER TABLE "vhc_items" ADD COLUMN "quotedLabourCost" DECIMAL(10,2);
ALTER TABLE "vhc_items" ADD COLUMN "quotedPartsCost" DECIMAL(10,2);
ALTER TABLE "vhc_items" ADD COLUMN "quotedTotal" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "job_card_operation_lines" (
    "id" TEXT NOT NULL,
    "jobCardId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "estimatedMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_card_operation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_card_line_clock_entries" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "clockOn" TIMESTAMP(3) NOT NULL,
    "clockOff" TIMESTAMP(3),

    CONSTRAINT "job_card_line_clock_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vhc_item_parts" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "vhc_item_parts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "job_card_operation_lines" ADD CONSTRAINT "job_card_operation_lines_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "job_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_card_line_clock_entries" ADD CONSTRAINT "job_card_line_clock_entries_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "job_card_operation_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_card_line_clock_entries" ADD CONSTRAINT "job_card_line_clock_entries_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vhc_item_parts" ADD CONSTRAINT "vhc_item_parts_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "vhc_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vhc_item_parts" ADD CONSTRAINT "vhc_item_parts_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
