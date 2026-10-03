import { ConsentType, SignatureDocType } from '@project-amx/shared';
import { ComplianceService } from './compliance.service';

const dealerId = 'dealer-1';

describe('ComplianceService', () => {
  it('records a consent with the capturing user and dealer scope', async () => {
    const prisma = { consentRecord: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)) } };
    const service = new ComplianceService(prisma as never);
    await service.createConsent(
      dealerId,
      { customerName: 'Sarah', consentType: ConsentType.MARKETING_EMAIL, granted: true },
      'Jo Bloggs',
    );
    const data = prisma.consentRecord.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ dealerId, capturedBy: 'Jo Bloggs', granted: true, consentType: ConsentType.MARKETING_EMAIL });
  });

  it('stores a captured signature with its source IP for audit', async () => {
    const prisma = { documentSignature: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)) } };
    const service = new ComplianceService(prisma as never);
    await service.createSignature(
      dealerId,
      { documentType: SignatureDocType.DEAL, documentRef: 'DS-2026-00001', signerName: 'Sarah', signatureData: 'data:image/png;base64,AAA' },
      '203.0.113.7',
    );
    const data = prisma.documentSignature.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ dealerId, ipAddress: '203.0.113.7', documentRef: 'DS-2026-00001' });
  });
});
