import { VehicleContactRole } from '@project-amx/shared';
import { VehicleContactsService } from './vehicle-contacts.service';

describe('VehicleContactsService', () => {
  const dealerId = 'dealer-1';
  const vehicleId = 'vehicle-1';

  function makePrisma(overrides: Record<string, unknown> = {}) {
    return {
      vehicle: { findFirst: jest.fn().mockResolvedValue({ id: vehicleId, dealerId }) },
      contact: { findFirst: jest.fn().mockResolvedValue({ id: 'contact-1', dealerId }) },
      vehicleContact: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'link-1' }),
        update: jest.fn().mockResolvedValue({ id: 'link-1', endedAt: new Date() }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      ...overrides,
    };
  }

  describe('list / listForContact', () => {
    it('throws if the vehicle does not belong to this dealer', async () => {
      const prisma = makePrisma({ vehicle: { findFirst: jest.fn().mockResolvedValue(null) } });
      const service = new VehicleContactsService(prisma as never);
      await expect(service.list(dealerId, vehicleId)).rejects.toThrow('Vehicle not found');
    });

    it('throws if the contact does not belong to this dealer', async () => {
      const prisma = makePrisma({ contact: { findFirst: jest.fn().mockResolvedValue(null) } });
      const service = new VehicleContactsService(prisma as never);
      await expect(service.listForContact(dealerId, 'contact-1')).rejects.toThrow('Contact not found');
    });

    it('lists links for a vehicle', async () => {
      const prisma = makePrisma();
      const service = new VehicleContactsService(prisma as never);
      await service.list(dealerId, vehicleId);
      expect(prisma.vehicleContact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { vehicleId } }),
      );
    });
  });

  describe('link', () => {
    it('ends any other current OWNER before creating a new one', async () => {
      const prisma = makePrisma();
      const service = new VehicleContactsService(prisma as never);
      await service.link(dealerId, vehicleId, { contactId: 'contact-1', role: VehicleContactRole.OWNER });

      expect(prisma.vehicleContact.updateMany).toHaveBeenCalledWith({
        where: { vehicleId, role: VehicleContactRole.OWNER, endedAt: null },
        data: { endedAt: expect.any(Date) },
      });
      expect(prisma.vehicleContact.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { vehicleId, contactId: 'contact-1', role: VehicleContactRole.OWNER } }),
      );
    });

    it('ends any other current KEEPER before creating a new one', async () => {
      const prisma = makePrisma();
      const service = new VehicleContactsService(prisma as never);
      await service.link(dealerId, vehicleId, { contactId: 'contact-1', role: VehicleContactRole.KEEPER });
      expect(prisma.vehicleContact.updateMany).toHaveBeenCalledWith({
        where: { vehicleId, role: VehicleContactRole.KEEPER, endedAt: null },
        data: { endedAt: expect.any(Date) },
      });
    });

    it('does not end existing links when adding a DRIVER — several can be current at once', async () => {
      const prisma = makePrisma();
      const service = new VehicleContactsService(prisma as never);
      await service.link(dealerId, vehicleId, { contactId: 'contact-1', role: VehicleContactRole.DRIVER });
      expect(prisma.vehicleContact.updateMany).not.toHaveBeenCalled();
    });

    it('throws if the vehicle does not belong to this dealer', async () => {
      const prisma = makePrisma({ vehicle: { findFirst: jest.fn().mockResolvedValue(null) } });
      const service = new VehicleContactsService(prisma as never);
      await expect(
        service.link(dealerId, vehicleId, { contactId: 'contact-1', role: VehicleContactRole.OWNER }),
      ).rejects.toThrow('Vehicle not found');
    });

    it('throws if the contact does not belong to this dealer', async () => {
      const prisma = makePrisma({ contact: { findFirst: jest.fn().mockResolvedValue(null) } });
      const service = new VehicleContactsService(prisma as never);
      await expect(
        service.link(dealerId, vehicleId, { contactId: 'contact-1', role: VehicleContactRole.OWNER }),
      ).rejects.toThrow('Contact not found');
    });
  });

  describe('end', () => {
    it('sets endedAt on a current link', async () => {
      const prisma = makePrisma({
        vehicleContact: {
          findFirst: jest.fn().mockResolvedValue({ id: 'link-1', vehicleId, endedAt: null }),
          update: jest.fn().mockResolvedValue({ id: 'link-1', endedAt: new Date() }),
        },
      });
      const service = new VehicleContactsService(prisma as never);
      await service.end(dealerId, vehicleId, 'link-1');
      expect(prisma.vehicleContact.update).toHaveBeenCalledWith({
        where: { id: 'link-1' },
        data: { endedAt: expect.any(Date) },
      });
    });

    it('refuses to end a link that has already ended', async () => {
      const prisma = makePrisma({
        vehicleContact: {
          findFirst: jest.fn().mockResolvedValue({ id: 'link-1', vehicleId, endedAt: new Date() }),
          update: jest.fn(),
        },
      });
      const service = new VehicleContactsService(prisma as never);
      await expect(service.end(dealerId, vehicleId, 'link-1')).rejects.toThrow('already ended');
    });

    it('throws if the link is not found on this vehicle', async () => {
      const prisma = makePrisma({ vehicleContact: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() } });
      const service = new VehicleContactsService(prisma as never);
      await expect(service.end(dealerId, vehicleId, 'link-1')).rejects.toThrow('Vehicle-contact link not found');
    });
  });
});
