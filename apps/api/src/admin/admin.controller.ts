import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Headers,
  UseGuards, Request,
  ForbiddenException,
  HttpCode, HttpStatus,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UserRole } from '../users/entities/user.entity';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  // GET /admin/users?search=...
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('users')
  getUsers(@Query('search') search?: string) {
    return this.adminService.getUsers(search);
  }

  // PATCH /admin/users/:id – смена роли или активности
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('users/:id')
  updateUser(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() body: { role?: string; isActive?: boolean },
  ) {
    // Нельзя изменить самого себя через эту панель
    if (req.user.id === id) {
      throw new ForbiddenException('Нельзя изменить собственный аккаунт через панель');
    }
    const data: { role?: UserRole; isActive?: boolean } = {};
    if (body.role !== undefined) data.role = body.role as UserRole;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    return this.adminService.updateUser(id, data);
  }

  // ── Глобальные события ──────────────────────────────────────

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('events')
  getGlobalTasks() {
    return this.adminService.getGlobalTasks();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('events')
  createGlobalTask(@Request() req: { user: { id: string } }, @Body() body: {
    title: string; description?: string; date: string;
    time?: string; repeat?: string; repeatUntil?: string; icon?: string;
  }) {
    return this.adminService.createGlobalTask(body, req.user.id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('events/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteGlobalTask(@Param('id') id: string) {
    return this.adminService.deleteGlobalTask(id);
  }
}
