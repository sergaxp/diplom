import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from 'minio';
import { randomUUID } from 'crypto';
import { extname } from 'path';

const BUCKET     = 'avatars';
const ATT_BUCKET = 'attachments';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: Client;
  private readonly publicUrl: string;
  private readonly attPublicUrl: string;

  constructor() {
    const endpoint = process.env.MINIO_ENDPOINT ?? 'localhost';
    const port     = parseInt(process.env.MINIO_PORT    ?? '9000', 10);

    this.client = new Client({
      endPoint:  endpoint,
      port,
      useSSL:    false,
      accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin123',
    });

    // В prod: MINIO_PUBLIC_URL=https://diplom.warmingtea.su/files (уже включает путь к бакету)
    // В dev: строим URL из endpoint:port/bucket
    this.publicUrl = process.env.MINIO_PUBLIC_URL ?? `http://${endpoint}:${port}/${BUCKET}`;

    // Attachments bucket: env MINIO_PUBLIC_URL_ATTACHMENTS or derived from public host
    const attBase = process.env.MINIO_PUBLIC_URL_ATTACHMENTS;
    if (attBase) {
      this.attPublicUrl = attBase;
    } else if (process.env.MINIO_PUBLIC_URL) {
      // strip trailing bucket segment and append the attachments bucket
      this.attPublicUrl = process.env.MINIO_PUBLIC_URL.replace(/\/[^/]+$/, '') + '/' + ATT_BUCKET;
    } else {
      this.attPublicUrl = `http://${endpoint}:${port}/${ATT_BUCKET}`;
    }
  }

  async onModuleInit() {
    for (const b of [BUCKET, ATT_BUCKET]) {
      try {
        const exists = await this.client.bucketExists(b);
        if (!exists) {
          await this.client.makeBucket(b);
          this.logger.log(`Бакет "${b}" создан`);
        }
        await this.client.setBucketPolicy(
          b,
          JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect:    'Allow',
                Principal: { AWS: ['*'] },
                Action:    ['s3:GetObject'],
                Resource:  [`arn:aws:s3:::${b}/*`],
              },
            ],
          }),
        );
        this.logger.log(`Бакет "${b}" готов`);
      } catch (err) {
        this.logger.error(`Ошибка инициализации MinIO (${b})`, err);
      }
    }
  }

  async uploadAvatar(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
  ): Promise<string> {
    const filename = `${randomUUID()}${extname(originalName).toLowerCase()}`;
    await this.client.putObject(BUCKET, filename, buffer, buffer.length, {
      'Content-Type': mimeType,
    });
    return `${this.publicUrl}/${filename}`;
  }

  /** Upload a generic attachment. Returns { url, key }. */
  async uploadAttachment(buffer: Buffer, originalName: string, mimeType: string) {
    const safeName = originalName.replace(/[^\w.\-]/g, '_');
    const key = `${randomUUID()}_${safeName}`;
    await this.client.putObject(ATT_BUCKET, key, buffer, buffer.length, {
      'Content-Type': mimeType,
    });
    return { url: `${this.attPublicUrl}/${key}`, key };
  }

  async deleteAttachment(key: string) {
    try {
      await this.client.removeObject(ATT_BUCKET, key);
    } catch (err) {
      this.logger.warn(`deleteAttachment failed for "${key}": ${(err as Error).message}`);
    }
  }
}
