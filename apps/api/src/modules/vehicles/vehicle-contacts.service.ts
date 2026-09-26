import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { VehicleContactRole } from '@project-amx/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LinkVehicleContactDto } from './dto/vehicle-contact.dto';

/**
 * Module 19 — a vehicle's owner/keeper/driver relationships to CRM contacts, kept as history
 * rather than a single column so a change of keeper (trade-in, lease handover, company car
 * reassignment) doesn't lose the record of who held it before. See the VehicleContact schema
 * comment for the OWNER/KEEPER/DRIVER distinction.
 */
@Injectable()
export class VehicleContactsService {
  constructor(private readonly prisma: PrismaService) {}

  private async verifyVehicleOwnership(dealerId: string, vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id: vehicleId, dealerId } });
    if (!vehicle) {
      throw new NotFoundException('Vehicle not found');
    }
  }

  async list(dealerId: string, vehicleId: string) {
    await this.verifyVehicleOwnership(dealerId, vehicleId);
    return this.prisma.vehicleContact.findMany({
      where: { vehicleId },
      include: { contact: true },
      orderBy: [{ endedAt: 'asc' }, { startedAt: 'desc' }],
    });
  }

  async listForContact(dealerId: string, contactId: string) {
    const contact = await this.prisma.contact.findFirst({ where: { id: contactId, dealerId } });
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }
    return this.prisma.vehicleContact.findMany({
      where: { contactId },
      include: { vehicle: true },
      orderBy: [{ endedAt: 'asc' }, { startedAt: 'desc' }],
    });
  }

  /** Links a contact to a vehicle with a role. Adding a new OWNER or KEEPER automatically ends any
   * other current holder of that same role on this vehicle — a vehicle only has one current owner
   * and one current keeper at a time — but DRIVER links can stack (a company car with several
   * named drivers). */
  async link(dealerId: string, vehicleId: string, dto: LinkVehicleContactDto) {
    await this.verifyVehicleOwnership(dealerId, vehicleId);
    const contact = await this.prisma.contact.findFirst({ where: { id: dto.contactId, dealerId } });
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    if (dto.role !== VehicleContactRole.DRIVER) {
      await this.prisma.vehicleContact.updateMany({
        where: { vehicleId, role: dto.role, endedAt: null },
        data: { endedAt: new Date() },
      });
    }

    return this.prisma.vehicleContact.create({
      data: { vehicleId, contactId: dto.contactId, role: dto.role },
      include: { contact: true },
    });
  }

  /** Ends a link (sets endedAt) rather than deleting it, so the vehicle's history of past
   * owners/keepers/drivers is preserved. */
  async end(dealerId: string, vehicleId: string, linkId: string) {
    await this.verifyVehicleOwnership(dealerId, vehicleId);
    const link = await this.prisma.vehicleContact.findFirst({ where: { id: linkId, vehicleId } });
    if (!link) {
      throw new NotFoundException('Vehicle-contact link not found');
    }
    if (link.endedAt) {
      throw new BadRequestException('This link has already ended');
    }
    return this.prisma.vehicleContact.update({ where: { id: linkId }, data: { endedAt: new Date() } });
  }
}
