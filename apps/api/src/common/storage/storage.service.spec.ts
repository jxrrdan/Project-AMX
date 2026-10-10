import { PutObjectCommand } from '@aws-sdk/client-s3';
import { StorageService } from './storage.service';

const send = jest.fn().mockResolvedValue({});
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

function config(values: Record<string, string>) {
  return {
    get: (k: string, d?: string) => values[k] ?? d,
    getOrThrow: (k: string) => {
      if (!values[k]) throw new Error(`missing ${k}`);
      return values[k];
    },
  };
}

describe('StorageService s3 driver', () => {
  it('uploads privately encrypted under the dealer prefix and returns the CDN URL', async () => {
    const service = new StorageService(
      config({ STORAGE_DRIVER: 's3', STORAGE_S3_BUCKET: 'bkt', STORAGE_PUBLIC_BASE_URL: 'https://files.example.co.uk/' }) as never,
    );
    const url = await service.put('dealer-1', 'vhc', 'brake.jpg', Buffer.from('x'));
    expect(url).toMatch(/^https:\/\/files\.example\.co\.uk\/dealer-dealer-1\/vhc\/.+-brake\.jpg$/);
    const input = (PutObjectCommand as unknown as jest.Mock).mock.calls[0][0];
    expect(input).toMatchObject({ Bucket: 'bkt', ContentType: 'image/jpeg', ServerSideEncryption: 'AES256' });
  });

  it('refuses an unknown driver instead of silently dropping the file', async () => {
    const service = new StorageService(config({ STORAGE_DRIVER: 'nope' }) as never);
    await expect(service.put('d', 'c', 'f.txt', Buffer.from('x'))).rejects.toThrow('Unknown STORAGE_DRIVER');
  });
});
