import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  Request,
  ForbiddenException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UserRole } from '../users/entities/user.entity';
import { TaskRepeat } from '../tasks/entities/task.entity';
import { FeedbackService } from '../feedback/feedback.service';
import type { BugReportStatus } from '../feedback/entities/bug-report.entity';
import type { FeatureRequestStatus } from '../feedback/entities/feature-request.entity';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly feedbackService: FeedbackService,
  ) {}

  // POST /admin/promote – создание первого или любого администратора
  // Требует секретный ключ из .env (не требует JWT)
  @Post('promote')
  async promote(
    @Headers('x-admin-secret') secret: string,
    @Body('username') username: string,
  ) {
    const envSecret = process.env.ADMIN_SECRET;
    if (!envSecret || !secret || secret !== envSecret) {
      throw new ForbiddenException('Неверный секретный ключ');
    }
    if (!username?.trim()) {
      throw new ForbiddenException('Укажите имя пользователя');
    }
    return this.adminService.promote(username.trim());
  }

  // GET /admin/stats
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  // GET /admin/users?search=...
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('users')
  getUsers(@Query('search') search?: string) {
    return this.adminService.getUsers(search);
  }

  // PATCH /admin/users/:id – смена роли или активности
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('users/:id')
  updateUser(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() body: { role?: string; isActive?: boolean },
  ) {
    // Нельзя изменить самого себя через эту панель
    if (req.user.id === id) {
      throw new ForbiddenException(
        'Нельзя изменить собственный аккаунт через панель',
      );
    }
    const data: { role?: UserRole; isActive?: boolean } = {};
    if (body.role !== undefined) data.role = body.role as UserRole;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    return this.adminService.updateUser(id, data);
  }

  // PATCH /admin/users/:id/coins – выдать (или списать) монеты пользователю
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('users/:id/coins')
  grantCoins(@Param('id') id: string, @Body('amount') amount: number) {
    return this.adminService.grantCoins(id, Number(amount));
  }

  // DELETE /admin/users/:id – полное удаление пользователя и его данных
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteUser(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    if (req.user.id === id) {
      throw new ForbiddenException(
        'Нельзя удалить собственный аккаунт через панель',
      );
    }
    return this.adminService.deleteUser(id);
  }

  // ── Глобальные события ──────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('events')
  getGlobalTasks() {
    return this.adminService.getGlobalTasks();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('events')
  createGlobalTask(
    @Request() req: { user: { id: string } },
    @Body()
    body: {
      title: string;
      description?: string;
      date: string;
      time?: string;
      repeat?: TaskRepeat;
      repeatUntil?: string;
      icon?: string;
    },
  ) {
    return this.adminService.createGlobalTask(body, req.user.id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('events/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteGlobalTask(@Param('id') id: string) {
    return this.adminService.deleteGlobalTask(id);
  }

  // ── Обратная связь ──────────────────────────────────────────────

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('feedback/bugs')
  getAllBugReports() {
    return this.feedbackService.getAllBugReports();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('feedback/features')
  getAllFeatureRequests() {
    return this.feedbackService.getAllFeatureRequests();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('feedback/bugs/:id')
  updateBugStatus(
    @Param('id') id: string,
    @Body('status') status: BugReportStatus,
  ) {
    return this.feedbackService.updateBugReportStatus(id, status);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('feedback/features/:id')
  updateFeatureStatus(
    @Param('id') id: string,
    @Body('status') status: FeatureRequestStatus,
  ) {
    return this.feedbackService.updateFeatureRequestStatus(id, status);
  }
}
