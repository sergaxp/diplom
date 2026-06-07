import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StorageService, BucketName, BUCKETS } from './storage.service';

const ALLOWED_MIME = /^(image\/(png|jpe?g|gif|webp)|video\/(mp4|webm|ogg)|application\/(zip|x-7z-compressed|x-rar-compressed|pdf))$/i;
const MAX_SIZE = 50 * 1024 * 1024;

const ALLOWED_BUCKETS = new Set<string>(Object.values(BUCKETS));
const CLIENT_BUCKETS: Set<BucketName> = new Set([BUCKETS.tasks, BUCKETS.feedback]);

const YT_RE    = /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
const VIMEO_RE = /vimeo\.com\/(\d+)/;

const FETCH_TIMEOUT_MS = 6_000;
const FETCH_MAX_BYTES  = 256 * 1024; // читаем не более 256 KB HTML

@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  private readonly logger = new Logger(StorageController.name);

  constructor(private readonly storage: StorageService) {}

  // ── Загрузка файла ─────────────────────────────────────────────
  // Квота: 30 загрузок / 5 минут на пользователя — защита от заполнения хранилища
  @Throttle({ default: { ttl: 300_000, limit: 30 } })
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file?: Express.Multer.File,
    @Query('bucket') bucketParam?: string,
  ) {
    if (!file) throw new BadRequestException('Файл не передан');
    if (file.size > MAX_SIZE) throw new BadRequestException('Файл слишком большой (макс. 50 MB)');
    if (!ALLOWED_MIME.test(file.mimetype)) throw new BadRequestException(`Тип файла не поддерживается: ${file.mimetype}`);

    const bucket = (bucketParam ?? BUCKETS.tasks) as BucketName;
    if (!ALLOWED_BUCKETS.has(bucket) || !CLIENT_BUCKETS.has(bucket)) {
      throw new BadRequestException(`Недопустимый бакет: ${bucket}`);
    }

    const { url, key } = await this.storage.upload(
      file.buffer,
      file.originalname,
      file.mimetype,
      bucket,
    );
    return { url, key, name: file.originalname, type: file.mimetype, size: file.size };
  }

  // ── Удаление файла ─────────────────────────────────────────────
  @Delete('object')
  async remove(@Body() body: { key?: string; bucket?: string }) {
    if (!body?.key) throw new BadRequestException('key обязателен');
    const bucket = (body.bucket ?? BUCKETS.tasks) as BucketName;
    if (!ALLOWED_BUCKETS.has(bucket) || !CLIENT_BUCKETS.has(bucket)) {
      throw new BadRequestException(`Недопустимый бакет: ${bucket}`);
    }
    await this.storage.delete(body.key, bucket);
    return { ok: true };
  }

  // ── Превью ссылки ──────────────────────────────────────────────
  @Get('link-preview')
  async linkPreview(@Query('url') rawUrl?: string): Promise<{ title: string | null; thumbnailUrl: string | null }> {
    if (!rawUrl) throw new BadRequestException('url обязателен');

    let url: URL;
    try { url = new URL(rawUrl); } catch { throw new BadRequestException('Некорректный URL'); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new BadRequestException('Только http/https');

    // YouTube — oEmbed
    if (YT_RE.test(rawUrl)) {
      try {
        const r = await this.fetchJson<{ title: string; thumbnail_url: string }>(
          `https://www.youtube.com/oembed?url=${encodeURIComponent(rawUrl)}&format=json`,
        );
        return { title: r.title ?? null, thumbnailUrl: r.thumbnail_url ?? null };
      } catch (e) {
        this.logger.warn(`YouTube oEmbed failed: ${e}`);
      }
    }

    // Vimeo — oEmbed
    if (VIMEO_RE.test(rawUrl)) {
      try {
        const r = await this.fetchJson<{ title: string; thumbnail_url: string }>(
          `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(rawUrl)}`,
        );
        return { title: r.title ?? null, thumbnailUrl: r.thumbnail_url ?? null };
      } catch (e) {
        this.logger.warn(`Vimeo oEmbed failed: ${e}`);
      }
    }

    // Общий случай — парсим HTML
    try {
      const html = await this.fetchHtml(rawUrl);
      const title = this.extractTitle(html);
      return { title, thumbnailUrl: null };
    } catch (e) {
      this.logger.warn(`link-preview fetch failed for ${rawUrl}: ${e}`);
    }

    return { title: null, thumbnailUrl: null };
  }

  // ── Вспомогательные ───────────────────────────────────────────

  private async fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'User-Agent': 'Warmingtea-bot/1.0' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<T>;
  }

  private async fetchHtml(url: string): Promise<string> {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Warmingtea-bot/1.0)',
        'Accept': 'text/html',
        'Accept-Language': 'ru,en;q=0.9',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader = res.body?.getReader();
    if (!reader) return '';
    let result = '';
    let bytes = 0;
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += decoder.decode(value, { stream: true });
      bytes += value?.length ?? 0;
      if (bytes >= FETCH_MAX_BYTES) { reader.cancel(); break; }
    }
    return result;
  }

  private extractTitle(html: string): string | null {
    // og:title — наиболее точный
    const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
            ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
    if (og?.[1]) return this.decodeHtml(og[1].trim());

    // <title>
    const t = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (t?.[1]) return this.decodeHtml(t[1].trim());

    return null;
  }

  private decodeHtml(s: string): string {
    return s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  }
}
