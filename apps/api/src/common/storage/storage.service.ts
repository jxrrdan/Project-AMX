import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

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
  private s3?: S3Client;

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

    if (this.driver === 's3') {
      const bucket = this.config.getOrThrow<string>('STORAGE_S3_BUCKET');
      // Credentials come from the ECS task role; objects are private and read through CloudFront
      // (origin access control) at STORAGE_PUBLIC_BASE_URL, never via public S3 ACLs.
      this.s3 ??= new S3Client({ region: this.config.get<string>('AWS_REGION', 'eu-west-2') });
      await this.s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: data,
          ContentType: contentTypeFor(filename),
          ServerSideEncryption: 'AES256',
        }),
      );
      const base = this.config.getOrThrow<string>('STORAGE_PUBLIC_BASE_URL').replace(/\/+$/, '');
      return `${base}/${key}`;
    }

    throw new Error(`Unknown STORAGE_DRIVER "${this.driver}"`);
  }
}

const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  html: 'text/html; charset=utf-8',
  csv: 'text/csv',
  json: 'application/json',
};

function contentTypeFor(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}
