import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from 'minio';
import { randomUUID } from 'crypto';
import { extname } from 'path';

export const BUCKETS = {
  profiles: 'profiles', // аватары и обложки профиля
  tasks: 'tasks', // вложения задач
  feedback: 'feedback', // файлы баг-репортов
} as const;

export type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: Client;
  private readonly endpoint: string;
  private readonly port: number;

  constructor() {
    this.endpoint = process.env.MINIO_ENDPOINT ?? 'localhost';
    this.port = parseInt(process.env.MINIO_PORT ?? '9000', 10);

    this.client = new Client({
      endPoint: this.endpoint,
      port: this.port,
      useSSL: false,
      accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin123',
    });
  }

  async onModuleInit() {
    for (const bucket of Object.values(BUCKETS)) {
      try {
        const exists = await this.client.bucketExists(bucket);
        if (!exists) {
          await this.client.makeBucket(bucket);
          this.logger.log(`Бакет "${bucket}" создан`);
        }
        await this.client.setBucketPolicy(
          bucket,
          JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Principal: { AWS: ['*'] },
                Action: ['s3:GetObject'],
                Resource: [`arn:aws:s3:::${bucket}/*`],
              },
            ],
          }),
        );
        this.logger.log(`Бакет "${bucket}" готов`);
      } catch (err) {
        this.logger.error(`Ошибка инициализации MinIO (${bucket})`, err);
      }
    }
  }

  private publicUrlFor(bucket: BucketName): string {
    // В prod: MINIO_PUBLIC_URL_<BUCKET> переопределяет базовый URL для бакета
    const envKey = `MINIO_PUBLIC_URL_${bucket.toUpperCase()}`;
    if (process.env[envKey]) return process.env[envKey].replace(/\/+$/, '');
    if (process.env.MINIO_PUBLIC_URL) {
      // MINIO_PUBLIC_URL — общий публичный префикс (напр. https://host/files,
      // который reverse-proxy маршрутизирует в MinIO). Путь к бакету
      // достраивается СЕГМЕНТОМ, а не заменой последнего сегмента,
      // иначе префикс /files терялся и ссылки отдавали 404.
      const base = process.env.MINIO_PUBLIC_URL.replace(/\/+$/, '');
      return `${base}/${bucket}`;
    }
    return `http://${this.endpoint}:${this.port}/${bucket}`;
  }

  /** Загрузить файл в указанный бакет. Возвращает { url, key }. */
  async upload(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    bucket: BucketName,
  ): Promise<{ url: string; key: string }> {
    const safeName = originalName.replace(/[^\w.-]/g, '_');
    const key = `${randomUUID()}_${safeName}`;
    await this.client.putObject(bucket, key, buffer, buffer.length, {
      'Content-Type': mimeType,
    });
    return { url: `${this.publicUrlFor(bucket)}/${key}`, key };
  }

  /** Загрузить аватар или обложку профиля (бакет profiles). */
  async uploadProfile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
  ): Promise<string> {
    const filename = `${randomUUID()}${extname(originalName).toLowerCase()}`;
    await this.client.putObject(
      BUCKETS.profiles,
      filename,
      buffer,
      buffer.length,
      {
        'Content-Type': mimeType,
      },
    );
    return `${this.publicUrlFor(BUCKETS.profiles)}/${filename}`;
  }

  /** Удалить объект из указанного бакета по его ключу. */
  async delete(key: string, bucket: BucketName): Promise<void> {
    try {
      await this.client.removeObject(bucket, key);
    } catch (err) {
      this.logger.warn(
        `delete failed (${bucket}/${key}): ${(err as Error).message}`,
      );
    }
  }
}
