import { PrismaClient } from '@prisma/client';
// seed.ts runs standalone via ts-node (see package.json "prisma.seed"), outside the Nx project graph.
// eslint-disable-next-line @nx/enforce-module-boundaries
import { ModuleKey, SYSTEM_ROLE_PERMISSIONS, SystemRole } from '../../../libs/shared/src/index';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const dealer = await prisma.dealer.upsert({
    where: { subdomain: 'bmwnorthampton' },
    update: {},
    create: {
      name: 'BMW Northampton',
      subdomain: 'bmwnorthampton',
      franchiseCode: 'BMW-UK-NN',
      address: 'Riverside Way, Northampton, NN1',
      timeZone: 'Europe/London',
      locale: 'en-GB',
      primaryColour: '#0066B1',
    },
  });

  await prisma.moduleLicense.createMany({
    data: Object.values(ModuleKey).map((module) => ({ dealerId: dealer.id, module, enabled: true })),
    skipDuplicates: true,
  });

  const roleIds: Record<SystemRole, string> = {} as Record<SystemRole, string>;
  for (const systemRole of Object.values(SystemRole)) {
    const role = await prisma.role.upsert({
      where: { dealerId_name: { dealerId: dealer.id, name: systemRole } },
      update: {},
      create: { dealerId: dealer.id, name: systemRole, systemRole, isCustom: false },
    });
    roleIds[systemRole] = role.id;

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: SYSTEM_ROLE_PERMISSIONS[systemRole].map((p) => ({
        roleId: role.id,
        module: p.module,
        action: p.action,
      })),
    });
  }

  const passwordHash = await bcrypt.hash('Password123!', 12);

  const principal = await prisma.user.upsert({
    where: { dealerId_email: { dealerId: dealer.id, email: 'principal@bmwnorthampton.ams-app.co.uk' } },
    update: {},
    create: {
      dealerId: dealer.id,
      email: 'principal@bmwnorthampton.ams-app.co.uk',
      firstName: 'Alex',
      lastName: 'Whitfield',
      passwordHash,
      roles: { create: { roleId: roleIds[SystemRole.DEALER_PRINCIPAL] } },
    },
  });

  const workshopController = await prisma.user.upsert({
    where: { dealerId_email: { dealerId: dealer.id, email: 'workshop@bmwnorthampton.ams-app.co.uk' } },
    update: {},
    create: {
      dealerId: dealer.id,
      email: 'workshop@bmwnorthampton.ams-app.co.uk',
      firstName: 'Sam',
      lastName: 'Carter',
      passwordHash,
      roles: { create: { roleId: roleIds[SystemRole.WORKSHOP_CONTROLLER] } },
    },
  });

  const technician = await prisma.user.upsert({
    where: { dealerId_email: { dealerId: dealer.id, email: 'tech@bmwnorthampton.ams-app.co.uk' } },
    update: {},
    create: {
      dealerId: dealer.id,
      email: 'tech@bmwnorthampton.ams-app.co.uk',
      firstName: 'Priya',
      lastName: 'Shah',
      passwordHash,
      roles: { create: { roleId: roleIds[SystemRole.TECHNICIAN] } },
    },
  });

  const bays = await Promise.all(
    ['Bay 1', 'Bay 2', 'Bay 3', 'PDI Bay'].map((name) =>
      prisma.bay.upsert({
        where: { dealerId_name: { dealerId: dealer.id, name } },
        update: {},
        create: { dealerId: dealer.id, name },
      }),
    ),
  );

  const vehicle = await prisma.vehicle.upsert({
    where: { dealerId_vin: { dealerId: dealer.id, vin: 'WBA12345678901234' } },
    update: {},
    create: {
      dealerId: dealer.id,
      vin: 'WBA12345678901234',
      model: 'BMW iX1 xDrive30',
      colour: 'Sapphire Black',
      customerName: 'Jordan Douglas',
      eta: new Date(Date.now() + 3 * 24 * 3600 * 1000),
      status: 'ARRIVED',
      allocatedAdvisorId: workshopController.id,
    },
  });

  await prisma.jobCard.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      dealerId: dealer.id,
      customerName: 'Jordan Douglas',
      vehicleId: vehicle.id,
      vehicleReg: 'NN26 AMX',
      jobType: 'PDI',
      description: 'Pre-delivery inspection',
      estimatedHours: 1.5,
      status: 'SCHEDULED',
      bayId: bays[3].id,
      assignedTechnicianId: technician.id,
      serviceAdvisorId: workshopController.id,
      scheduledStart: new Date(),
      scheduledEnd: new Date(Date.now() + 90 * 60 * 1000),
    },
  });

  const part = await prisma.part.upsert({
    where: { dealerId_partNumber: { dealerId: dealer.id, partNumber: '11-42-8-635-689' } },
    update: {},
    create: {
      dealerId: dealer.id,
      partNumber: '11-42-8-635-689',
      description: 'Oil filter element',
      binLocation: 'A1-04',
      quantityOnHand: 12,
      reorderLevel: 5,
      costPrice: 8.5,
    },
  });

  const contact = await prisma.contact.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      dealerId: dealer.id,
      firstName: 'Morgan',
      lastName: 'Reid',
      email: 'morgan.reid@example.co.uk',
      phone: '+44 7700 900123',
      status: 'PROSPECT',
      gdprConsent: true,
    },
  });

  const usedVehicle = await prisma.usedVehicle.upsert({
    where: { dealerId_reg: { dealerId: dealer.id, reg: 'NN71 XYZ' } },
    update: {},
    create: {
      dealerId: dealer.id,
      reg: 'NN71 XYZ',
      make: 'BMW',
      model: '320d M Sport',
      colour: 'Mineral Grey',
      mileage: 18500,
      fuel: 'Diesel',
      transmission: 'Automatic',
      purchasePrice: 21000,
      askingPrice: 24495,
      source: 'PART_EX',
      status: 'IN_STOCK',
    },
  });

  await prisma.lead.upsert({
    where: { id: '00000000-0000-0000-0000-000000000020' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000020',
      dealerId: dealer.id,
      contactId: contact.id,
      usedVehicleId: usedVehicle.id,
      stage: 'ENQUIRY',
      source: 'WEBSITE_FORM',
      assignedSalespersonId: principal.id,
    },
  });

  // Recall campaign management — an OEM safety recall with a couple of affected vehicles.
  const recallCampaign = await prisma.recallCampaign.upsert({
    where: { id: '00000000-0000-0000-0000-000000000030' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000030',
      dealerId: dealer.id,
      code: '0067340700',
      title: 'Front passenger airbag inflator inspection',
      description: 'Inspect and, if required, replace the front passenger airbag inflator module.',
      affectedModels: '3 Series (G20), 4 Series (G22)',
      launchedAt: new Date('2026-08-01'),
      status: 'OPEN',
    },
  });

  await prisma.recallVehicle.upsert({
    where: { id: '00000000-0000-0000-0000-000000000031' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000031',
      dealerId: dealer.id,
      campaignId: recallCampaign.id,
      vehicleId: vehicle.id,
      vin: vehicle.vin,
      registration: 'NN21 ABC',
      customerName: 'Sarah Hughes',
      customerContact: 'sarah.hughes@example.com',
      status: 'OUTSTANDING',
    },
  });

  await prisma.recallVehicle.upsert({
    where: { id: '00000000-0000-0000-0000-000000000032' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000032',
      dealerId: dealer.id,
      campaignId: recallCampaign.id,
      vin: 'WBA00000000009999',
      registration: 'NN19 DEF',
      customerName: 'Tom Reilly',
      customerContact: '07700 900123',
      status: 'BOOKED',
      bookedDate: new Date('2026-09-20'),
    },
  });

  // Credit note — a goodwill credit raised against a customer, already issued and numbered.
  await prisma.creditNote.upsert({
    where: { id: '00000000-0000-0000-0000-000000000040' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000040',
      dealerId: dealer.id,
      number: 'CN-2026-00001',
      customerName: 'Sarah Hughes',
      reason: 'Goodwill gesture — courtesy car unavailable for booked service',
      relatedInvoiceRef: 'INV-2026-00042',
      status: 'ISSUED',
      subtotal: 50.0,
      taxAmount: 10.0,
      total: 60.0,
      issuedAt: new Date('2026-09-15'),
      lines: {
        create: [
          {
            id: '00000000-0000-0000-0000-000000000041',
            description: 'Goodwill credit — service inconvenience',
            quantity: 1,
            unitPrice: 50.0,
            taxRate: 0.2,
            lineTotal: 50.0,
          },
        ],
      },
    },
  });

  // Keep the CN document-number sequence consistent with the seeded credit note above
  // (which took CN-2026-00001), so the next note a user issues gets CN-2026-00002.
  await prisma.documentSequence.upsert({
    where: {
      dealerId_docType_year: { dealerId: dealer.id, docType: 'CREDIT_NOTE', year: new Date().getFullYear() },
    },
    update: {},
    create: {
      dealerId: dealer.id,
      docType: 'CREDIT_NOTE',
      year: new Date().getFullYear(),
      prefix: 'CN',
      nextNumber: 2,
    },
  });

  console.log('Seed complete.');
  console.log('Dealer subdomain: bmwnorthampton');
  console.log('Login: principal@bmwnorthampton.ams-app.co.uk / workshop@... / tech@... — password: Password123!');
  console.log('Part on hand:', part.partNumber);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
