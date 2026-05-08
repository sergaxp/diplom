import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from 'minio';
import { randomUUID } from 'crypto';
import { extname } from 'path';

const BUCKET = 'avatars';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: Client;
  private readonly publicUrl: string;

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

    this.publicUrl = `http://${endpoint}:${port}`;
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(BUCKET);
      if (!exists) {
        await this.client.makeBucket(BUCKET);
        this.logger.log(`Бакет "${BUCKET}" создан`);
      }
      // Публичный доступ на чтение
      await this.client.setBucketPolicy(
        BUCKET,
        JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect:    'Allow',
              Principal: { AWS: ['*'] },
              Action:    ['s3:GetObject'],
              Resource:  [`arn:aws:s3:::${BUCKET}/*`],
            },
          ],
        }),
      );
      this.logger.log(`Бакет "${BUCKET}" готов`);
    } catch (err) {
      this.logger.error('Ошибка инициализации MinIO', err);
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
    return `${this.publicUrl}/${BUCKET}/${filename}`;
  }
}
