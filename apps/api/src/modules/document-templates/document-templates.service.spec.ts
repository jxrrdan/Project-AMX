import { NotFoundException } from '@nestjs/common';
import { DocumentTemplateType } from '@project-amx/shared';
import { DocumentTemplatesService } from './document-templates.service';

describe('DocumentTemplatesService', () => {
  const dealerId = 'dealer-1';

  it('get throws for another dealer\'s template', async () => {
    const prisma = { documentTemplate: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new DocumentTemplatesService(prisma as never);
    await expect(service.get(dealerId, 'other-dealer-template')).rejects.toThrow(NotFoundException);
  });

  it('update refuses another dealer\'s template', async () => {
    const update = jest.fn();
    const prisma = { documentTemplate: { findFirst: jest.fn().mockResolvedValue(null), update } };
    const service = new DocumentTemplatesService(prisma as never);
    await expect(service.update(dealerId, 'other-dealer-template', { name: 'x' })).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it('delete refuses another dealer\'s template', async () => {
    const del = jest.fn();
    const prisma = { documentTemplate: { findFirst: jest.fn().mockResolvedValue(null), delete: del } };
    const service = new DocumentTemplatesService(prisma as never);
    await expect(service.delete(dealerId, 'other-dealer-template')).rejects.toThrow(NotFoundException);
    expect(del).not.toHaveBeenCalled();
  });

  it('setDefault unsets any other default of the same type before setting the new one', async () => {
    const template = { id: 'tpl-1', dealerId, type: DocumentTemplateType.DEAL_SHEET, isDefault: false };
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const update = jest.fn().mockResolvedValue({ ...template, isDefault: true });
    const tx = { documentTemplate: { updateMany, update } };
    const prisma = {
      documentTemplate: { findFirst: jest.fn().mockResolvedValue(template) },
      $transaction: jest.fn().mockImplementation((fn) => fn(tx)),
    };
    const service = new DocumentTemplatesService(prisma as never);

    await service.setDefault(dealerId, 'tpl-1');

    expect(updateMany).toHaveBeenCalledWith({
      where: { dealerId, type: DocumentTemplateType.DEAL_SHEET, isDefault: true },
      data: { isDefault: false },
    });
    expect(update).toHaveBeenCalledWith({ where: { id: 'tpl-1' }, data: { isDefault: true } });
  });

  it('getDefaultBody returns the built-in fallback when the dealer has not set one up', async () => {
    const prisma = { documentTemplate: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new DocumentTemplatesService(prisma as never);

    const body = await service.getDefaultBody(dealerId, DocumentTemplateType.DEAL_SHEET, '<html>fallback</html>');

    expect(body).toBe('<html>fallback</html>');
  });

  it('getDefaultBody returns the dealer\'s own default template body when set', async () => {
    const prisma = {
      documentTemplate: { findFirst: jest.fn().mockResolvedValue({ bodyHtml: '<html>custom</html>' }) },
    };
    const service = new DocumentTemplatesService(prisma as never);

    const body = await service.getDefaultBody(dealerId, DocumentTemplateType.DEAL_SHEET, '<html>fallback</html>');

    expect(body).toBe('<html>custom</html>');
  });
});
