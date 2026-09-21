import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ActionTriggerPoint, ConfigScope, IntegrationTargetEntity } from '@project-amx/shared';
import axios from 'axios';
import { TenancyScopeService } from '../../common/tenancy/tenancy-scope.service';
import { ActionTriggersService } from './action-triggers.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function makeService(prisma: Record<string, unknown>) {
  const tenancy = new TenancyScopeService(prisma as never);
  return new ActionTriggersService(prisma as never, tenancy);
}

function noHierarchyPrisma(overrides: Record<string, unknown> = {}) {
  return {
    dealer: { findUnique: jest.fn().mockResolvedValue({ franchiseId: null, franchise: null }) },
    actionTrigger: { findUnique: jest.fn().mockResolvedValue(null), findFirst: jest.fn().mockResolvedValue(null) },
    ...overrides,
  };
}

describe('ActionTriggersService.create', () => {
  const dealerId = 'dealer-1';

  it('rejects an unsafe urlTemplate at creation time', async () => {
    const create = jest.fn();
    const prisma = noHierarchyPrisma({ actionTrigger: { create } });
    const service = makeService(prisma);

    await expect(
      service.create(dealerId, {
        name: 'Bad',
        triggerPoint: ActionTriggerPoint.USED_VEHICLE_REG_LOOKUP,
        targetEntity: IntegrationTargetEntity.USED_VEHICLE,
        config: { urlTemplate: 'http://169.254.169.254/{value}' },
      }),
    ).rejects.toThrow(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('creates a DEALER-scoped trigger by default', async () => {
    const create = jest.fn().mockResolvedValue({ id: 't1' });
    const prisma = noHierarchyPrisma({ actionTrigger: { create } });
    const service = makeService(prisma);

    await service.create(dealerId, {
      name: 'OEM lookup',
      triggerPoint: ActionTriggerPoint.USED_VEHICLE_REG_LOOKUP,
      targetEntity: IntegrationTargetEntity.USED_VEHICLE,
      config: { urlTemplate: 'https://oem.example.com/v/{value}' },
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ scope: ConfigScope.DEALER, dealerId, franchiseId: undefined, groupId: undefined }),
    });
  });
});

describe('ActionTriggersService.get/update/delete — tenant scoping', () => {
  const dealerId = 'dealer-1';

  it('get throws for a trigger belonging to another dealer', async () => {
    const prisma = noHierarchyPrisma({
      actionTrigger: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 't1', scope: ConfigScope.DEALER, dealerId: 'other-dealer', franchiseId: null, groupId: null }),
      },
    });
    const service = makeService(prisma);
    await expect(service.get(dealerId, 't1')).rejects.toThrow(NotFoundException);
  });

  it('delete refuses a trigger belonging to another dealer', async () => {
    const del = jest.fn();
    const prisma = noHierarchyPrisma({
      actionTrigger: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 't1', scope: ConfigScope.DEALER, dealerId: 'other-dealer', franchiseId: null, groupId: null }),
        delete: del,
      },
    });
    const service = makeService(prisma);
    await expect(service.delete(dealerId, 't1')).rejects.toThrow(NotFoundException);
    expect(del).not.toHaveBeenCalled();
  });
});

describe('ActionTriggersService.run', () => {
  const dealerId = 'dealer-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when no active trigger is configured for this trigger point', async () => {
    const prisma = noHierarchyPrisma();
    const service = makeService(prisma);

    const result = await service.run(dealerId, ActionTriggerPoint.USED_VEHICLE_REG_LOOKUP, 'AB12CDE');

    expect(result).toBeNull();
    expect(mockedAxios.request).not.toHaveBeenCalled();
  });

  it('calls the configured API with {value} substituted and maps the response', async () => {
    const trigger = {
      id: 't1',
      name: 'OEM lookup',
      targetEntity: IntegrationTargetEntity.USED_VEHICLE,
      config: { urlTemplate: 'https://oem.example.com/v/{value}', method: 'GET' },
    };
    const prisma = noHierarchyPrisma({
      actionTrigger: { findFirst: jest.fn().mockResolvedValue(trigger) },
      actionTriggerMapping: {
        findMany: jest.fn().mockResolvedValue([{ sourcePath: 'colour', targetField: 'colour', isCustomField: false, transform: null }]),
      },
    });
    mockedAxios.request.mockResolvedValue({ data: { colour: 'Alpine White' } });
    const service = makeService(prisma);

    const result = await service.run(dealerId, ActionTriggerPoint.USED_VEHICLE_REG_LOOKUP, 'AB12CDE');

    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://oem.example.com/v/AB12CDE', method: 'GET' }),
    );
    expect(result).toEqual({ triggerName: 'OEM lookup', columnValues: { colour: 'Alpine White' }, customFieldValues: {} });
  });

  it('degrades to null (never throws) when an unsafe urlTemplate slipped past creation-time validation', async () => {
    const trigger = {
      id: 't1',
      name: 'Bad',
      targetEntity: IntegrationTargetEntity.USED_VEHICLE,
      config: { urlTemplate: 'http://127.0.0.1/{value}' },
    };
    const prisma = noHierarchyPrisma({
      actionTrigger: { findFirst: jest.fn().mockResolvedValue(trigger) },
      actionTriggerMapping: { findMany: jest.fn().mockResolvedValue([]) },
    });
    const service = makeService(prisma);

    const result = await service.run(dealerId, ActionTriggerPoint.USED_VEHICLE_REG_LOOKUP, 'AB12CDE');

    expect(result).toBeNull();
    expect(mockedAxios.request).not.toHaveBeenCalled();
  });

  it('degrades to null (never throws) when the configured API is unreachable, so the caller\'s own database search is unaffected', async () => {
    const trigger = {
      id: 't1',
      name: 'OEM lookup',
      targetEntity: IntegrationTargetEntity.USED_VEHICLE,
      config: { urlTemplate: 'https://api.example-bmw-oem.co.uk/vehicles/{value}' },
    };
    const prisma = noHierarchyPrisma({
      actionTrigger: { findFirst: jest.fn().mockResolvedValue(trigger) },
      actionTriggerMapping: { findMany: jest.fn().mockResolvedValue([]) },
    });
    mockedAxios.request.mockRejectedValue(new Error('getaddrinfo ENOTFOUND api.example-bmw-oem.co.uk'));
    const service = makeService(prisma);

    const result = await service.run(dealerId, ActionTriggerPoint.USED_VEHICLE_REG_LOOKUP, 'AB12CDE');

    expect(result).toBeNull();
  });

  it('prefers a DEALER-scoped trigger over a FRANCHISE-scoped one', async () => {
    const dealerTrigger = { id: 'dealer-trigger', name: 'Dealer own', targetEntity: IntegrationTargetEntity.USED_VEHICLE, config: {} };
    const findFirst = jest.fn().mockResolvedValueOnce(dealerTrigger);
    const prisma = {
      dealer: { findUnique: jest.fn().mockResolvedValue({ franchiseId: 'f1', franchise: { groupId: null } }) },
      actionTrigger: { findFirst },
      actionTriggerMapping: { findMany: jest.fn().mockResolvedValue([]) },
    };
    mockedAxios.request.mockResolvedValue({ data: {} });
    const service = makeService(prisma);

    // No urlTemplate configured -> run() logs and returns null without ever calling axios,
    // which is enough to prove only ONE findFirst call happened (the DEALER-scope one).
    await service.run(dealerId, ActionTriggerPoint.USED_VEHICLE_REG_LOOKUP, 'AB12CDE');

    expect(findFirst).toHaveBeenCalledTimes(1);
    expect(findFirst).toHaveBeenCalledWith({ where: { scope: 'DEALER', dealerId, triggerPoint: ActionTriggerPoint.USED_VEHICLE_REG_LOOKUP, active: true } });
  });
});
