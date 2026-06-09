import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { ProfileService } from './profile.service';
import { StorageService, BUCKETS } from '../storage/storage.service';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.gif'];

const imageFilter = (
  _req: unknown,
  file: Express.Multer.File,
  cb: (err: Error | null, accept: boolean) => void,
) => {
  if (ALLOWED_EXT.includes(extname(file.originalname).toLowerCase())) {
    cb(null, true);
  } else {
    cb(new BadRequestException('Допустимые форматы: JPG, PNG, GIF'), false);
  }
};

@ApiTags('profile')
@Controller('profile')
export class ProfileController {
  constructor(
    private readonly profileService: ProfileService,
    private readonly storage: StorageService,
  ) {}

  // ── Посты ──────────────────────────────────────────────────

  // POST /profile/posts (multipart: text + опциональный file)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('posts')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: imageFilter,
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 МБ
    }),
  )
  async createPost(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreatePostDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const image = file
      ? await this.storage.upload(
          file.buffer,
          file.originalname,
          file.mimetype,
          BUCKETS.tasks,
        )
      : null;
    return this.profileService.createPost(req.user.id, dto.text, image);
  }

  // GET /profile/posts/:username (public)
  @Get('posts/:username')
  listPosts(@Param('username') username: string) {
    return this.profileService.listPosts(username);
  }

  // PATCH /profile/posts/:id/pin (auth, владелец)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('posts/:id/pin')
  setPinned(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { pinned: boolean },
  ) {
    return this.profileService.setPinned(id, req.user.id, !!body.pinned);
  }

  // DELETE /profile/posts/:id (auth, владелец)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePost(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    await this.profileService.deletePost(id, req.user.id);
  }

  // ── Комментарии ────────────────────────────────────────────

  // POST /profile/comments (auth — любой вошедший)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('comments')
  createComment(
    @Request() req: AuthenticatedRequest,
    @Body() dto: CreateCommentDto,
  ) {
    return this.profileService.createComment(req.user.id, dto);
  }

  // GET /profile/comments?username=&postId= (public)
  @Get('comments')
  listComments(
    @Query('username') username: string,
    @Query('postId') postId?: string,
  ) {
    return this.profileService.listComments(username, postId);
  }

  // DELETE /profile/comments/:id (auth — автор или владелец профиля)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteComment(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    await this.profileService.deleteComment(id, req.user.id);
  }

  // ── Витрины ────────────────────────────────────────────────

  // GET /profile/stats/:username (public)
  @Get('stats/:username')
  getStats(@Param('username') username: string) {
    return this.profileService.getStats(username);
  }

  // GET /profile/inventory/:username (public)
  @Get('inventory/:username')
  getInventory(@Param('username') username: string) {
    return this.profileService.getInventory(username);
  }

  // GET /profile/achievements/:username (public) — дерево достижений пользователя
  @Get('achievements/:username')
  getAchievements(@Param('username') username: string) {
    return this.profileService.getAchievements(username);
  }
}
