import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/**
 * File storage abstraction. Production target is AWS S3 (paths prefixed
 * `s3://ams-files/dealer-{id}/...` per the architecture spec); STORAGE_DRIVER=local writes to
 * disk under STORAGE_LOCAL_PATH so the app is fully runnable without AWS credentials.
 * Swap in an S3 driver here (behind this same interface) for production deploys — see
 * infra/cdk for the bucket definition.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: string;
  private readonly localPath: string;

  constructor(private readonly config: ConfigService) {
    this.driver = this.config.get<string>('STORAGE_DRIVER', 'local');
    this.localPath = this.config.get<string>('STORAGE_LOCAL_PATH', './.data/storage');
  }

  /** Stores a buffer under `dealer-{dealerId}/{category}/...` and returns a retrievable URL. */
  async put(dealerId: string, category: string, filename: string, data: Buffer): Promise<string> {
    const key = `dealer-${dealerId}/${category}/${randomUUID()}-${filename}`;

    if (this.driver === 'local') {
      const fullPath = join(this.localPath, key);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, data);
      return `/storage/${key}`;
    }

    this.logger.warn(`Storage driver "${this.driver}" not implemented locally; returning key only`);
    return `s3://ams-files/${key}`;
  }
}
