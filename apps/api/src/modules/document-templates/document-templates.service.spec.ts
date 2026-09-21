import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigScope, DocumentTemplateType } from '@project-amx/shared';
import { TenancyScopeService } from '../../common/tenancy/tenancy-scope.service';
import { DocumentTemplatesService } from './document-templates.service';

const NULL_ROW = { scope: null, dealerId: null, franchiseId: null, groupId: null };

function makeService(prisma: Record<string, unknown>) {
  const tenancy = new TenancyScopeService(prisma as never);
  return new DocumentTemplatesService(prisma as never, tenancy);
}

describe('DocumentTemplatesService — dealer-only (no franchise/group)', () => {
  const dealerId = 'dealer-1';

  function basePrisma(overrides: Record<string, unknown> = {}) {
    return {
      dealer: { findUnique: jest.fn().mockResolvedValue({ franchiseId: null, franchise: null }) },
      documentTemplate: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn().mockResolvedValue(null) },
      ...overrides,
    };
  }

  it('get throws for a template that does not exist', async () => {
    const service = makeService(basePrisma());
    await expect(service.get(dealerId, 'missing-template')).rejects.toThrow(NotFoundException);
  });

  it("get throws for another dealer's DEALER-scoped template", async () => {
    const prisma = basePrisma({
      documentTemplate: {
        findUnique: jest.fn().mockResolvedValue({ ...NULL_ROW, scope: ConfigScope.DEALER, dealerId: 'other-dealer' }),
      },
    });
    const service = makeService(prisma);
    await expect(service.get(dealerId, 'tpl-1')).rejects.toThrow(NotFoundException);
  });

  it('update refuses another dealer\'s template', async () => {
    const update = jest.fn();
    const prisma = basePrisma({
      documentTemplate: {
        findUnique: jest.fn().mockResolvedValue({ ...NULL_ROW, scope: ConfigScope.DEALER, dealerId: 'other-dealer' }),
        update,
      },
    });
    const service = makeService(prisma);
    await expect(service.update(dealerId, 'other-dealer-template', { name: 'x' })).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
  });

  it('delete refuses another dealer\'s template', async () => {
    const del = jest.fn();
    const prisma = basePrisma({
      documentTemplate: {
        findUnique: jest.fn().mockResolvedValue({ ...NULL_ROW, scope: ConfigScope.DEALER, dealerId: 'other-dealer' }),
        delete: del,
      },
    });
    const service = makeService(prisma);
    await expect(service.delete(dealerId, 'other-dealer-template')).rejects.toThrow(NotFoundException);
    expect(del).not.toHaveBeenCalled();
  });

  it('create defaults to DEALER scope, attached to the calling dealer', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'tpl-1' });
    const prisma = basePrisma({ documentTemplate: { create } });
    const service = makeService(prisma);

    await service.create(dealerId, { type: DocumentTemplateType.DEAL_SHEET, name: 'Std', bodyHtml: '<html></html>' });

    expect(create).toHaveBeenCalledWith({
      data: {
        scope: ConfigScope.DEALER,
        type: DocumentTemplateType.DEAL_SHEET,
        name: 'Std',
        bodyHtml: '<html></html>',
        dealerId,
        franchiseId: undefined,
        groupId: undefined,
      },
    });
  });

  it('create at FRANCHISE scope rejects when the dealer has no franchise', async () => {
    const create = jest.fn();
    const prisma = basePrisma({ documentTemplate: { create } });
    const service = makeService(prisma);

    await expect(
      service.create(dealerId, { type: DocumentTemplateType.DEAL_SHEET, name: 'Std', bodyHtml: '<html></html>', scope: ConfigScope.FRANCHISE }),
    ).rejects.toThrow(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('setDefault unsets any other DEALER-scoped default of the same type before setting the new one', async () => {
    const template = { id: 'tpl-1', scope: ConfigScope.DEALER, dealerId, franchiseId: null, groupId: null, type: DocumentTemplateType.DEAL_SHEET, isDefault: false };
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const update = jest.fn().mockResolvedValue({ ...template, isDefault: true });
    const tx = { documentTemplate: { updateMany, update } };
    const prisma = basePrisma({
      documentTemplate: { findUnique: jest.fn().mockResolvedValue(template) },
      $transaction: jest.fn().mockImplementation((fn) => fn(tx)),
    });
    const service = makeService(prisma);

    await service.setDefault(dealerId, 'tpl-1');

    expect(updateMany).toHaveBeenCalledWith({
      where: { type: DocumentTemplateType.DEAL_SHEET, isDefault: true, scope: ConfigScope.DEALER, dealerId, franchiseId: undefined, groupId: undefined },
      data: { isDefault: false },
    });
    expect(update).toHaveBeenCalledWith({ where: { id: 'tpl-1' }, data: { isDefault: true } });
  });

  it('getDefaultBody returns the built-in fallback when nobody has set one up', async () => {
    const service = makeService(basePrisma());
    const body = await service.getDefaultBody(dealerId, DocumentTemplateType.DEAL_SHEET, '<html>fallback</html>');
    expect(body).toBe('<html>fallback</html>');
  });

  it("getDefaultBody returns the dealer's own default template body when set", async () => {
    const prisma = basePrisma({
      documentTemplate: { findFirst: jest.fn().mockResolvedValue({ bodyHtml: '<html>custom</html>' }) },
    });
    const service = makeService(prisma);
    const body = await service.getDefaultBody(dealerId, DocumentTemplateType.DEAL_SHEET, '<html>fallback</html>');
    expect(body).toBe('<html>custom</html>');
  });
});

describe('DocumentTemplatesService — franchise/group cascading', () => {
  const dealerId = 'dealer-1';
  const franchiseId = 'franchise-1';
  const groupId = 'group-1';

  function prismaWithHierarchy() {
    return {
      dealer: {
        findUnique: jest.fn().mockResolvedValue({ franchiseId, franchise: { groupId } }),
      },
      documentTemplate: { findFirst: jest.fn() },
    };
  }

  it('getDefaultBody prefers a FRANCHISE default over a GROUP default when the dealer has no DEALER-scoped one', async () => {
    const prisma = prismaWithHierarchy();
    (prisma.documentTemplate.findFirst as jest.Mock)
      .mockResolvedValueOnce(null) // DEALER scope: nothing
      .mockResolvedValueOnce({ bodyHtml: '<html>franchise-brand</html>' }); // FRANCHISE scope: found
    const service = makeService(prisma);

    const body = await service.getDefaultBody(dealerId, DocumentTemplateType.DEAL_SHEET, '<html>fallback</html>');

    expect(body).toBe('<html>franchise-brand</html>');
    expect(prisma.documentTemplate.findFirst).toHaveBeenNthCalledWith(1, {
      where: { scope: ConfigScope.DEALER, dealerId, type: DocumentTemplateType.DEAL_SHEET, isDefault: true },
    });
    expect(prisma.documentTemplate.findFirst).toHaveBeenNthCalledWith(2, {
      where: { scope: ConfigScope.FRANCHISE, franchiseId, type: DocumentTemplateType.DEAL_SHEET, isDefault: true },
    });
  });

  it('getDefaultBody falls through to GROUP when neither DEALER nor FRANCHISE has a default', async () => {
    const prisma = prismaWithHierarchy();
    (prisma.documentTemplate.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ bodyHtml: '<html>group-brand</html>' });
    const service = makeService(prisma);

    const body = await service.getDefaultBody(dealerId, DocumentTemplateType.DEAL_SHEET, '<html>fallback</html>');

    expect(body).toBe('<html>group-brand</html>');
  });

  it('a dealer in a franchise can create a FRANCHISE-scoped template attached to their own franchise', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'tpl-2' });
    const prisma = { ...prismaWithHierarchy(), documentTemplate: { create } };
    const service = makeService(prisma);

    await service.create(dealerId, {
      type: DocumentTemplateType.DEAL_SHEET,
      name: 'Brand standard',
      bodyHtml: '<html></html>',
      scope: ConfigScope.FRANCHISE,
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        scope: ConfigScope.FRANCHISE,
        type: DocumentTemplateType.DEAL_SHEET,
        name: 'Brand standard',
        bodyHtml: '<html></html>',
        dealerId: undefined,
        franchiseId,
        groupId: undefined,
      },
    });
  });

  it('cannot access a FRANCHISE-scoped template belonging to a different franchise', async () => {
    const prisma = {
      ...prismaWithHierarchy(),
      documentTemplate: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ...NULL_ROW, scope: ConfigScope.FRANCHISE, franchiseId: 'someone-elses-franchise' }),
      },
    };
    const service = makeService(prisma);
    await expect(service.get(dealerId, 'tpl-3')).rejects.toThrow(NotFoundException);
  });
});
