import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { VatReturnStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Making Tax Digital (MTD) submission to HMRC's VAT API. Mocked the same way the Xero/Sage/
 * QuickBooks accounting sync and DVLA vehicle lookup are mocked elsewhere in this app: there are
 * no real Government Gateway credentials in this environment. A production adapter would exchange
 * an OAuth token for the dealer's Government Gateway account and POST the VAT100 boxes to
 * HMRC's /organisations/vat/{vrn}/returns endpoint behind this same interface.
 */
@Injectable()
export class MtdSubmissionService {
  private readonly logger = new Logger(MtdSubmissionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async submit(dealerId: string, vatReturnId: string) {
    const dealer = await this.prisma.dealer.findFirst({ where: { id: dealerId } });
    if (!dealer?.vatNumber) {
      throw new BadRequestException('Set the dealer\'s VAT registration number in Settings before submitting to HMRC');
    }

    const vatReturn = await this.prisma.vatReturn.findFirst({ where: { id: vatReturnId, dealerId } });
    if (!vatReturn) {
      throw new NotFoundException('VAT return not found');
    }
    if (vatReturn.status === VatReturnStatus.SUBMITTED) {
      throw new BadRequestException('This VAT return has already been submitted');
    }

    const submissionRef = `MTD-MOCK-${randomUUID().slice(0, 8).toUpperCase()}`;
    this.logger.log(
      `[MTD mock submission] VRN ${dealer.vatNumber} period ${vatReturn.periodStart.toISOString().slice(0, 10)}–${vatReturn.periodEnd
        .toISOString()
        .slice(0, 10)} netVatDue ${vatReturn.box5NetVatDue} → HMRC (ref ${submissionRef})`,
    );

    return this.prisma.vatReturn.update({
      where: { id: vatReturnId },
      data: { status: VatReturnStatus.SUBMITTED, hmrcSubmissionRef: submissionRef, submittedAt: new Date() },
    });
  }
}
