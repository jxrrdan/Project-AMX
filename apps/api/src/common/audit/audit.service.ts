import { Injectable } from '@nestjs/common';
import { ModuleKey } from '@project-amx/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntryInput {
  dealerId: string;
  userId?: string;
  module: ModuleKey;
  action: string;
  recordType: string;
  recordId: string;
  before?: unknown;
  after?: unknown;
}

/**
 * Writes to the immutable audit_log table (Feature Spec §7.5). In production this is also
 * streamed to the /ams/audit CloudWatch log group as a secondary backup — see
 * docs/observability.md; locally the Postgres row is the single source of truth.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntryInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        dealerId: entry.dealerId,
        userId: entry.userId,
        module: entry.module,
        action: entry.action,
        recordType: entry.recordType,
        recordId: entry.recordId,
        before: entry.before === undefined ? undefined : (entry.before as object),
        after: entry.after === undefined ? undefined : (entry.after as object),
      },
    });
  }
}
