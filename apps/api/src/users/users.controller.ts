import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
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
import { UsersService } from './users.service';
import { StorageService } from '../storage/storage.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangeEmailDto } from './dto/change-email.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.gif'];

const avatarFilter = (
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

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly storageService: StorageService,
  ) {}

  // GET /users/stats – публичная статистика для лендинга (без авторизации)
  @Get('stats')
  async publicStats() {
    return this.usersService.getPublicStats();
  }

  // GET /users/me
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req: AuthenticatedRequest) {
    return this.usersService.findById(req.user.id);
  }

  // PATCH /users/me
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(
    @Request() req: AuthenticatedRequest,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(req.user.id, dto);
  }

  // PATCH /users/me/password – смена пароля
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Request() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.usersService.changePassword(req.user.id, dto);
  }

  // PATCH /users/me/email – смена email
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('me/email')
  async changeEmail(
    @Request() req: AuthenticatedRequest,
    @Body() dto: ChangeEmailDto,
  ) {
    return this.usersService.changeEmail(req.user.id, dto);
  }

  // DELETE /users/me – удаление аккаунта
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(
    @Request() req: AuthenticatedRequest,
    @Body() dto: DeleteAccountDto,
  ) {
    await this.usersService.deleteAccount(req.user.id, dto.password);
  }

  // POST /users/me/avatar
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: avatarFilter,
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 МБ
    }),
  )
  async uploadAvatar(
    @Request() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Файл не загружен');
    const avatarUrl = await this.storageService.uploadProfile(
      file.buffer,
      file.originalname,
      file.mimetype,
    );
    return this.usersService.updateAvatar(req.user.id, avatarUrl);
  }

  // POST /users/me/cover
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('me/cover')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: avatarFilter,
      limits: { fileSize: 8 * 1024 * 1024 }, // 8 МБ
    }),
  )
  async uploadCover(
    @Request() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Файл не загружен');
    const coverUrl = await this.storageService.uploadProfile(
      file.buffer,
      file.originalname,
      file.mimetype,
    );
    return this.usersService.updateCover(req.user.id, coverUrl);
  }

  // POST /users/me/ping – обновить lastSeenAt (вызывается периодически с фронтенда)
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('me/ping')
  async ping(@Request() req: AuthenticatedRequest) {
    await this.usersService.updateLastSeen(req.user.id);
    const granted = await this.usersService.grantDailyBonusIfDue(req.user.id);
    return { dailyBonusGranted: granted };
  }

  // POST /users/me/settings-opened – пользователь открыл страницу настроек
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('me/settings-opened')
  async settingsOpened(@Request() req: AuthenticatedRequest) {
    const newAchievements = await this.usersService.markSettingsOpened(
      req.user.id,
    );
    return { newAchievements };
  }

  // GET /users/:username
  @Get(':username')
  async getPublicProfile(@Param('username') username: string) {
    return this.usersService.getPublicProfile(username);
  }
}
