import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JobCategory, SystemRole, TechnicianAvailabilityStatus } from '@project-amx/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SetTechnicianAvailabilityDto, SetTechnicianSkillsDto } from './dto/technician.dto';

const DEFAULT_DAILY_MINUTES = 480;

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function eachDateInRange(from: Date, to: Date): string[] {
  const dates: string[] = [];
  for (const cursor = new Date(from); cursor <= to; cursor.setDate(cursor.getDate() + 1)) {
    dates.push(toDateKey(cursor));
  }
  return dates;
}

/**
 * Technician skills + calendar-driven capacity (gap closed from the bay-only CapacityBlock model):
 * who is qualified for which JobCategory, who is in/out on a given day, and therefore how many
 * hours of each category the workshop can actually deliver — as distinct from bay availability.
 */
@Injectable()
export class TechniciansService {
  constructor(private readonly prisma: PrismaService) {}

  listTechnicians(dealerId: string) {
    return this.prisma.user.findMany({
      where: { dealerId, roles: { some: { role: { systemRole: SystemRole.TECHNICIAN } } } },
      include: { technicianSkills: true },
      orderBy: { firstName: 'asc' },
    });
  }

  /** Replaces a technician's full skill set in one call — simpler for a UI checklist than per-skill add/remove. */
  async setSkills(dealerId: string, userId: string, dto: SetTechnicianSkillsDto) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, dealerId } });
    if (!user) {
      throw new NotFoundException('Technician not found');
    }
    const unique = [...new Set(dto.categories)];
    await this.prisma.$transaction([
      this.prisma.technicianSkill.deleteMany({ where: { userId } }),
      this.prisma.technicianSkill.createMany({
        data: unique.map((category) => ({ dealerId, userId, category })),
      }),
    ]);
    return this.prisma.technicianSkill.findMany({ where: { userId } });
  }

  listAvailability(dealerId: string, from: string, to: string) {
    return this.prisma.technicianAvailability.findMany({
      where: { dealerId, date: { gte: new Date(from), lte: new Date(to) } },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { date: 'asc' },
    });
  }

  async setAvailability(dealerId: string, dto: SetTechnicianAvailabilityDto) {
    const user = await this.prisma.user.findFirst({ where: { id: dto.userId, dealerId } });
    if (!user) {
      throw new NotFoundException('Technician not found');
    }
    const date = new Date(dto.date);
    return this.prisma.technicianAvailability.upsert({
      where: { userId_date: { userId: dto.userId, date } },
      update: {
        status: dto.status,
        availableMinutes: dto.availableMinutes ?? DEFAULT_DAILY_MINUTES,
        note: dto.note,
      },
      create: {
        dealerId,
        userId: dto.userId,
        date,
        status: dto.status,
        availableMinutes: dto.availableMinutes ?? DEFAULT_DAILY_MINUTES,
        note: dto.note,
      },
    });
  }

  /**
   * Per-JobCategory, per-day capacity: sum of skilled + available technicians' hours vs. booked
   * hours (JobCard.estimatedHours grouped by category). A day with no TechnicianAvailability row
   * for a technician defaults to AVAILABLE at a standard 480-minute day — the calendar only needs
   * to be touched to record an *exception* (leave, sickness, training), not every ordinary day.
   */
  async capacityReport(dealerId: string, from: string, to: string) {
    if (new Date(from) > new Date(to)) {
      throw new BadRequestException('"from" must not be after "to"');
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);

    const [technicians, availabilityRows, jobCards] = await Promise.all([
      this.prisma.user.findMany({
        where: { dealerId, roles: { some: { role: { systemRole: SystemRole.TECHNICIAN } } } },
        include: { technicianSkills: true },
      }),
      this.prisma.technicianAvailability.findMany({
        where: { dealerId, date: { gte: fromDate, lte: toDate } },
      }),
      this.prisma.jobCard.findMany({
        where: { dealerId, scheduledStart: { gte: fromDate, lte: toDate } },
        select: { category: true, scheduledStart: true, estimatedHours: true },
      }),
    ]);

    const availabilityByKey = new Map<string, (typeof availabilityRows)[number]>();
    for (const row of availabilityRows) {
      availabilityByKey.set(`${row.userId}|${toDateKey(row.date)}`, row);
    }

    const dates = eachDateInRange(fromDate, toDate);
    const capacityMinutesByKey = new Map<string, number>();
    for (const tech of technicians) {
      const categories = tech.technicianSkills.map((s) => s.category);
      if (categories.length === 0) continue;
      for (const date of dates) {
        const row = availabilityByKey.get(`${tech.id}|${date}`);
        const status = row?.status ?? TechnicianAvailabilityStatus.AVAILABLE;
        if (status !== TechnicianAvailabilityStatus.AVAILABLE) continue;
        const minutes = row?.availableMinutes ?? DEFAULT_DAILY_MINUTES;
        for (const category of categories) {
          const key = `${category}|${date}`;
          capacityMinutesByKey.set(key, (capacityMinutesByKey.get(key) ?? 0) + minutes);
        }
      }
    }

    const bookedMinutesByKey = new Map<string, number>();
    for (const jc of jobCards) {
      if (!jc.scheduledStart) continue;
      const key = `${jc.category}|${toDateKey(jc.scheduledStart)}`;
      bookedMinutesByKey.set(key, (bookedMinutesByKey.get(key) ?? 0) + Number(jc.estimatedHours) * 60);
    }

    const allKeys = new Set([...capacityMinutesByKey.keys(), ...bookedMinutesByKey.keys()]);
    const rows = [...allKeys].map((key) => {
      const [category, date] = key.split('|') as [JobCategory, string];
      const capacityMinutes = capacityMinutesByKey.get(key) ?? 0;
      const bookedMinutes = bookedMinutesByKey.get(key) ?? 0;
      return {
        category,
        date,
        capacityMinutes,
        bookedMinutes,
        utilisationPct: capacityMinutes > 0 ? Math.round((bookedMinutes / capacityMinutes) * 100) : null,
      };
    });

    return rows.sort((a, b) => a.date.localeCompare(b.date) || a.category.localeCompare(b.category));
  }
}
