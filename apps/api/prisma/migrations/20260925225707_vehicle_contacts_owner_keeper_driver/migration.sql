-- CreateEnum
CREATE TYPE "VehicleContactRole" AS ENUM ('OWNER', 'KEEPER', 'DRIVER');

-- CreateTable
CREATE TABLE "vehicle_contacts" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" "VehicleContactRole" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_contacts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "vehicle_contacts" ADD CONSTRAINT "vehicle_contacts_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_contacts" ADD CONSTRAINT "vehicle_contacts_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
