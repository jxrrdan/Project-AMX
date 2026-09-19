-- CreateTable
CREATE TABLE "ui_screen_definitions" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "entity" "IntegrationTargetEntity" NOT NULL,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ui_screen_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ui_screen_definitions_dealerId_entity_key" ON "ui_screen_definitions"("dealerId", "entity");

-- AddForeignKey
ALTER TABLE "ui_screen_definitions" ADD CONSTRAINT "ui_screen_definitions_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
