import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ActionTriggerPoint, ConfigScope, IntegrationTargetEntity } from '@project-amx/shared';
import axios from 'axios';
import { PrismaService } from '../../common/prisma/prisma.service';
import { assertSafeOutboundUrl } from '../../common/security/outbound-url.util';
import { TenancyScopeService } from '../../common/tenancy/tenancy-scope.service';
import { applyTransform, coerceForColumn, isKnownTargetField, resolvePath } from '../integrations/field-mapping.util';
import { buildRequestHeaders, mergeConfigPreservingSecrets, redactConfigSecrets, type HeaderPair, type RestAuthConfig } from '../integrations/rest-auth.util';
import { ActionTriggerMappingDto, CreateActionTriggerDto, UpdateActionTriggerDto } from './dto/action-trigger.dto';

interface ActionTriggerConfig {
  /** e.g. "https://oem.example.com/vehicles/{value}" — {value} is replaced with the searched term. */
  urlTemplate?: string;
  method?: 'GET' | 'POST';
  headers?: HeaderPair[];
  auth?: RestAuthConfig;
  resultsPath?: string;
}

export interface ActionTriggerEnrichment {
  triggerName: string;
  columnValues: Record<string, unknown>;
  customFieldValues: Record<string, unknown>;
}

/**
 * Business-systems-manager-configurable "also call this API" hooks for user-facing lookup
 * functions (e.g. searching a used car by registration). Distinct from the OEM Integration Hub's
 * connectors (which run on a schedule/webhook against the DB) — a trigger fires synchronously
 * inside a normal request (alongside, not instead of, the database search) and returns enrichment
 * data for the caller to merge in, rather than writing to the DB itself.
 */
@Injectable()
export class ActionTriggersService {
  private readonly logger = new Logger(ActionTriggersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancy: TenancyScopeService,
  ) {}

  async list(dealerId: string, triggerPoint?: ActionTriggerPoint) {
    const ctx = await this.tenancy.resolve(dealerId);
    const clauses = this.tenancy.scopeWhereClauses(ctx);
    const triggers = await this.prisma.actionTrigger.findMany({
      where: { OR: clauses, triggerPoint: triggerPoint || undefined },
      include: { mappings: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return triggers.map((t) => ({ ...t, config: redactConfigSecrets(t.config) }));
  }

  async get(dealerId: string, id: string) {
    const trigger = await this.prisma.actionTrigger.findUnique({ where: { id }, include: { mappings: true } });
    if (!trigger || !(await this.tenancy.canAccess(dealerId, trigger))) {
      throw new NotFoundException('Action trigger not found');
    }
    return { ...trigger, config: redactConfigSecrets(trigger.config) };
  }

  async create(dealerId: string, dto: CreateActionTriggerDto) {
    this.validateConfigUrl(dto.config);
    const scope = dto.scope ?? ConfigScope.DEALER;
    const ownerId = await this.resolveOwnerId(dealerId, scope);
    return this.prisma.actionTrigger.create({
      data: {
        scope,
        name: dto.name,
        triggerPoint: dto.triggerPoint,
        targetEntity: dto.targetEntity,
        config: (dto.config ?? {}) as never,
        dealerId: scope === ConfigScope.DEALER ? ownerId : undefined,
        franchiseId: scope === ConfigScope.FRANCHISE ? ownerId : undefined,
        groupId: scope === ConfigScope.GROUP ? ownerId : undefined,
      },
    });
  }

  async update(dealerId: string, id: string, dto: UpdateActionTriggerDto) {
    const trigger = await this.getRaw(dealerId, id);
    const mergedConfig = dto.config ? mergeConfigPreservingSecrets(trigger.config, dto.config) : undefined;
    if (mergedConfig) {
      this.validateConfigUrl(mergedConfig);
    }
    const updated = await this.prisma.actionTrigger.update({
      where: { id },
      data: { name: dto.name, active: dto.active, config: mergedConfig as never },
    });
    return { ...updated, config: redactConfigSecrets(updated.config) };
  }

  async delete(dealerId: string, id: string) {
    await this.getRaw(dealerId, id);
    await this.prisma.actionTrigger.delete({ where: { id } });
    return { success: true };
  }

  async setMappings(dealerId: string, id: string, mappings: ActionTriggerMappingDto[]) {
    const trigger = await this.getRaw(dealerId, id);

    const customFieldKeys = new Set(
      (
        await this.prisma.customFieldDefinition.findMany({
          where: { dealerId, entity: trigger.targetEntity },
          select: { key: true },
        })
      ).map((f) => f.key),
    );

    for (const mapping of mappings) {
      if (mapping.isCustomField) {
        if (!customFieldKeys.has(mapping.targetField)) {
          throw new BadRequestException(`Unknown custom field "${mapping.targetField}" — create it first`);
        }
      } else if (!isKnownTargetField(trigger.targetEntity as unknown as IntegrationTargetEntity, mapping.targetField)) {
        throw new BadRequestException(`"${mapping.targetField}" is not a mappable field for this entity`);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.actionTriggerMapping.deleteMany({ where: { actionTriggerId: id } });
      await tx.actionTriggerMapping.createMany({
        data: mappings.map((m, index) => ({
          actionTriggerId: id,
          sourcePath: m.sourcePath,
          targetField: m.targetField,
          isCustomField: m.isCustomField ?? false,
          transform: m.transform,
          sortOrder: m.sortOrder ?? index,
        })),
      });
      return tx.actionTriggerMapping.findMany({ where: { actionTriggerId: id }, orderBy: { sortOrder: 'asc' } });
    });
  }

  /**
   * Fires the active trigger (if any, most specific scope wins) for this trigger point, calling
   * the configured external API with `value` substituted into the URL, and mapping its response
   * into column/custom-field values for the caller to merge alongside its own database search.
   * Returns null if no trigger is configured — callers should fall back to DB-only search.
   */
  async run(dealerId: string, triggerPoint: ActionTriggerPoint, value: string): Promise<ActionTriggerEnrichment | null> {
    const ctx = await this.tenancy.resolve(dealerId);
    let trigger: Awaited<ReturnType<typeof this.prisma.actionTrigger.findFirst>> = null;
    for (const clause of this.tenancy.scopeWhereClauses(ctx)) {
      trigger = await this.prisma.actionTrigger.findFirst({ where: { ...clause, triggerPoint, active: true } });
      if (trigger) break;
    }
    if (!trigger) return null;

    const mappings = await this.prisma.actionTriggerMapping.findMany({ where: { actionTriggerId: trigger.id }, orderBy: { sortOrder: 'asc' } });
    const config = (trigger.config ?? {}) as ActionTriggerConfig;
    if (!config.urlTemplate) {
      this.logger.warn(`Action trigger ${trigger.id} has no urlTemplate configured — skipping`);
      return null;
    }

    // This call runs alongside (never instead of) the caller's own database search, so a broken or
    // unreachable external API — an SSRF rejection, DNS failure, timeout, non-2xx response — must
    // degrade to "as if no trigger were configured" rather than fail the caller's whole request.
    try {
      const url = config.urlTemplate.replace('{value}', encodeURIComponent(value));
      assertSafeOutboundUrl(url);

      const response = await axios.request({
        url,
        method: config.method ?? 'GET',
        headers: buildRequestHeaders(config.headers, config.auth),
        timeout: 10_000,
      });
      const body = config.resultsPath ? resolvePath(response.data, config.resultsPath) : response.data;

      const columnValues: Record<string, unknown> = {};
      const customFieldValues: Record<string, unknown> = {};
      for (const mapping of mappings) {
        const raw = resolvePath(body, mapping.sourcePath);
        const transformed = applyTransform(raw, mapping.transform);
        if (transformed === undefined) continue;
        if (mapping.isCustomField) {
          customFieldValues[mapping.targetField] = transformed;
        } else if (isKnownTargetField(trigger.targetEntity as unknown as IntegrationTargetEntity, mapping.targetField)) {
          columnValues[mapping.targetField] = coerceForColumn(mapping.targetField, transformed);
        }
      }

      return { triggerName: trigger.name, columnValues, customFieldValues };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Action trigger ${trigger.id} failed to call its configured API — skipping: ${message}`);
      return null;
    }
  }

  private async getRaw(dealerId: string, id: string) {
    const trigger = await this.prisma.actionTrigger.findUnique({ where: { id } });
    if (!trigger || !(await this.tenancy.canAccess(dealerId, trigger))) {
      throw new NotFoundException('Action trigger not found');
    }
    return trigger;
  }

  private validateConfigUrl(config: Record<string, unknown> | undefined): void {
    const urlTemplate = (config ?? {})['urlTemplate'];
    if (typeof urlTemplate === 'string' && urlTemplate) {
      // Validate with the {value} placeholder stripped out — a bare placeholder isn't a real URL,
      // but the surrounding host/scheme the admin configured still needs to be safe.
      assertSafeOutboundUrl(urlTemplate.replace('{value}', 'placeholder'));
    }
  }

  private async resolveOwnerId(dealerId: string, scope: ConfigScope): Promise<string> {
    if (scope === ConfigScope.DEALER) return dealerId;
    const ctx = await this.tenancy.resolve(dealerId);
    if (scope === ConfigScope.FRANCHISE) {
      if (!ctx.franchiseId) throw new BadRequestException('Your outlet is not assigned to a franchise yet');
      return ctx.franchiseId;
    }
    if (!ctx.groupId) throw new BadRequestException("Your outlet's franchise is not assigned to a group yet");
    return ctx.groupId;
  }
}
