import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StorageService } from './storage.service';

const ALLOWED = /^(image\/(png|jpe?g|gif|webp)|video\/(mp4|webm|ogg)|application\/(zip|x-7z-compressed|x-rar-compressed|pdf))$/i;
const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Файл не передан');
    if (file.size > MAX_SIZE) throw new BadRequestException('Файл слишком большой (макс. 50 MB)');
    if (!ALLOWED.test(file.mimetype)) throw new BadRequestException(`Тип файла не поддерживается: ${file.mimetype}`);

    const { url, key } = await this.storage.uploadAttachment(
      file.buffer,
      file.originalname,
      file.mimetype,
    );
    return { url, key, name: file.originalname, type: file.mimetype, size: file.size };
  }

  @Delete('object')
  async remove(@Body() body: { key?: string }) {
    if (!body?.key) throw new BadRequestException('key обязателен');
    await this.storage.deleteAttachment(body.key);
    return { ok: true };
  }
}
