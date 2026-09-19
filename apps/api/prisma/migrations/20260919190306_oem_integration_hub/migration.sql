-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('REST_PULL', 'REST_PUSH', 'MQTT');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ERROR');

-- CreateEnum
CREATE TYPE "IntegrationTargetEntity" AS ENUM ('VEHICLE', 'USED_VEHICLE', 'PART', 'CONTACT');

-- CreateEnum
CREATE TYPE "CustomFieldDataType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'DATE');

-- CreateEnum
CREATE TYPE "IntegrationRunStatus" AS ENUM ('SUCCESS', 'ERROR');

-- AlterEnum
ALTER TYPE "ModuleKey" ADD VALUE 'OEM_INTEGRATIONS';

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "customFields" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "parts" ADD COLUMN     "customFields" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "used_vehicles" ADD COLUMN     "customFields" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "customFields" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "integration_connectors" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "targetEntity" "IntegrationTargetEntity" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'DRAFT',
    "config" JSONB NOT NULL DEFAULT '{}',
    "webhookToken" TEXT NOT NULL,
    "matchField" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_field_mappings" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "targetField" TEXT NOT NULL,
    "isCustomField" BOOLEAN NOT NULL DEFAULT false,
    "transform" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "integration_field_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_definitions" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "entity" "IntegrationTargetEntity" NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dataType" "CustomFieldDataType" NOT NULL DEFAULT 'STRING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_run_logs" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "status" "IntegrationRunStatus" NOT NULL,
    "recordsIn" INTEGER NOT NULL DEFAULT 0,
    "recordsMapped" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "rawPayloadSample" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_run_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "integration_connectors_webhookToken_key" ON "integration_connectors"("webhookToken");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_definitions_dealerId_entity_key_key" ON "custom_field_definitions"("dealerId", "entity", "key");

-- AddForeignKey
ALTER TABLE "integration_connectors" ADD CONSTRAINT "integration_connectors_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_field_mappings" ADD CONSTRAINT "integration_field_mappings_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "integration_connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_run_logs" ADD CONSTRAINT "integration_run_logs_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "integration_connectors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
