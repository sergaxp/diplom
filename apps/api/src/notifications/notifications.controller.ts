import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/authenticated-request';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  list(@Request() req: AuthenticatedRequest) {
    return this.svc.list(req.user.id);
  }

  @Get('unread-count')
  async unread(@Request() req: AuthenticatedRequest) {
    const count = await this.svc.unreadCount(req.user.id);
    return { count };
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markRead(
    @Request() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    await this.svc.markRead(req.user.id, id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async markAllRead(@Request() req: AuthenticatedRequest) {
    await this.svc.markAllRead(req.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    await this.svc.remove(req.user.id, id);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async clear(@Request() req: AuthenticatedRequest) {
    await this.svc.clearAll(req.user.id);
  }
}
