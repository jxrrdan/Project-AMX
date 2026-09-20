import { BadRequestException } from '@nestjs/common';
import { DealersService } from './dealers.service';

function makeStorage() {
  return { put: jest.fn().mockResolvedValue('/storage/dealer-1/branding/uuid-logo.png') };
}

describe('DealersService.uploadLogo', () => {
  const dealerId = 'dealer-1';

  it('rejects a value that is not a base64 image data URL', async () => {
    const prisma = { dealer: { update: jest.fn() } };
    const storage = makeStorage();
    const service = new DealersService(prisma as never, storage as never);

    await expect(service.uploadLogo(dealerId, 'https://example.com/logo.png')).rejects.toThrow(BadRequestException);
    expect(storage.put).not.toHaveBeenCalled();
    expect(prisma.dealer.update).not.toHaveBeenCalled();
  });

  it('rejects an oversized image', async () => {
    const prisma = { dealer: { update: jest.fn() } };
    const storage = makeStorage();
    const service = new DealersService(prisma as never, storage as never);
    const hugeBase64 = Buffer.alloc(3 * 1024 * 1024).toString('base64');

    await expect(service.uploadLogo(dealerId, `data:image/png;base64,${hugeBase64}`)).rejects.toThrow(BadRequestException);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('stores a valid PNG data URL and sets it as the dealer logo', async () => {
    const prisma = { dealer: { update: jest.fn().mockResolvedValue({ id: dealerId, logoUrl: '/storage/x' }) } };
    const storage = makeStorage();
    const service = new DealersService(prisma as never, storage as never);
    const smallBase64 = Buffer.from('fake-png-bytes').toString('base64');

    await service.uploadLogo(dealerId, `data:image/png;base64,${smallBase64}`);

    expect(storage.put).toHaveBeenCalledWith(dealerId, 'branding', 'logo.png', Buffer.from('fake-png-bytes'));
    expect(prisma.dealer.update).toHaveBeenCalledWith({
      where: { id: dealerId },
      data: { logoUrl: '/storage/dealer-1/branding/uuid-logo.png' },
    });
  });
});
