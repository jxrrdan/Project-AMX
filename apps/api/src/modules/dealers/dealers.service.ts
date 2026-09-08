import { Injectable } from '@nestjs/common';
import { ModuleKey } from '@project-amx/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SetModuleLicenseDto, UpdateDealerDto } from './dto/dealer.dto';

@Injectable()
export class DealersService {
  constructor(private readonly prisma: PrismaService) {}

  findOne(dealerId: string) {
    return this.prisma.dealer.findUnique({
      where: { id: dealerId },
      include: { moduleLicenses: true },
    });
  }

  update(dealerId: string, dto: UpdateDealerDto) {
    return this.prisma.dealer.update({ where: { id: dealerId }, data: dto });
  }

  /** Module licensing per Feature Spec §7.6 — enable/disable modules; billing wiring (Stripe) is a Phase 4 addition. */
  setModuleLicense(dealerId: string, dto: SetModuleLicenseDto) {
    return this.prisma.moduleLicense.upsert({
      where: { dealerId_module: { dealerId, module: dto.module } },
      update: { enabled: dto.enabled },
      create: { dealerId, module: dto.module, enabled: dto.enabled },
    });
  }

  async enabledModules(dealerId: string): Promise<ModuleKey[]> {
    const licenses = await this.prisma.moduleLicense.findMany({ where: { dealerId, enabled: true } });
    return licenses.map((l) => l.module as ModuleKey);
  }
}
