import {
  Controller,
  Put,
  Post,
  Body,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';
import { RemindersService } from './reminders.service';
import {
  SyncRemindersDto,
  SnoozeReminderDto,
  CompleteReminderDto,
} from './dto/sync-reminders.dto';

@ApiTags('reminders')
@Controller('reminders')
export class RemindersController {
  constructor(private readonly svc: RemindersService) {}

  @Put('sync')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async sync(
    @Request() req: AuthenticatedRequest,
    @Body() dto: SyncRemindersDto,
  ) {
    await this.svc.syncForTask(req.user.id, dto.taskId, dto.instances);
  }

  // Вызывается из Service Worker (нет access-токена) — авторизация через
  // подписанный токен из push-payload.
  @Post('snooze')
  @HttpCode(HttpStatus.NO_CONTENT)
  async snooze(@Body() dto: SnoozeReminderDto) {
    await this.svc.snooze(dto.token, dto.minutes ?? 10);
  }

  @Post('complete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async complete(@Body() dto: CompleteReminderDto) {
    await this.svc.complete(dto.token);
  }
}
