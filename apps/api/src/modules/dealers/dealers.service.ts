import { BadRequestException, Injectable } from '@nestjs/common';
import { ModuleKey } from '@project-amx/shared';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import { SetModuleLicenseDto, UpdateDealerDto } from './dto/dealer.dto';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

@Injectable()
export class DealersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

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

  /** Revokes the current workshop TV board link and issues a new one (§2.3). */
  regenerateBoardToken(dealerId: string) {
    return this.prisma.dealer.update({
      where: { id: dealerId },
      data: { workshopBoardToken: randomUUID() },
    });
  }

  /** Decodes a `data:image/...;base64,...` URI, stores it, and sets it as the dealer's logo. */
  async uploadLogo(dealerId: string, dataUrl: string) {
    const match = /^data:(image\/(?:png|jpeg|jpg|svg\+xml|webp));base64,(.+)$/.exec(dataUrl);
    if (!match) {
      throw new BadRequestException('Expected a base64 image data URL (png/jpeg/svg/webp)');
    }
    const [, mimeType, base64] = match;
    const buffer = Buffer.from(base64, 'base64');
    if (buffer.byteLength > MAX_LOGO_BYTES) {
      throw new BadRequestException('Logo must be 2MB or smaller');
    }
    const extension = mimeType.split('/')[1].replace('svg+xml', 'svg');
    const logoUrl = await this.storage.put(dealerId, 'branding', `logo.${extension}`, buffer);
    return this.prisma.dealer.update({ where: { id: dealerId }, data: { logoUrl } });
  }
}
