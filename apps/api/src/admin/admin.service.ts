import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { Task, TaskRepeat } from '../tasks/entities/task.entity';
import { GlobalTask } from '../tasks/entities/global-task.entity';
import { UsersService } from '../users/users.service';

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalTasks: number;
}

export interface AdminUpdateUserDto {
  role?: UserRole;
  isActive?: boolean;
}

export interface CreateGlobalTaskDto {
  title: string;
  description?: string;
  date: string;
  time?: string;
  repeat?: TaskRepeat;
  repeatUntil?: string;
  icon?: string;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)       private readonly userRepo: Repository<User>,
    @InjectRepository(Task)       private readonly taskRepo: Repository<Task>,
    @InjectRepository(GlobalTask) private readonly globalTaskRepo: Repository<GlobalTask>,
    private readonly usersService: UsersService,
  ) {}

  // ── Статистика ─────────────────────────────────────────────
  async getStats(): Promise<AdminStats> {
    const [totalUsers, activeUsers, totalTasks] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.count({ where: { isActive: true } }),
      this.taskRepo.count(),
    ]);
    return { totalUsers, activeUsers, totalTasks };
  }

  // ── Список пользователей ───────────────────────────────────
  async getUsers(search?: string): Promise<Partial<User>[]> {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .select([
        'u.id', 'u.username', 'u.email', 'u.displayName',
        'u.avatarUrl', 'u.role', 'u.isActive', 'u.createdAt', 'u.lastSeenAt',
      ])
      .orderBy('u.createdAt', 'DESC');

    if (search?.trim()) {
      qb.where('u.username ILIKE :q OR u.email ILIKE :q', { q: `%${search.trim()}%` });
    }

    return qb.getMany();
  }

  // ── Изменить роль / активность ─────────────────────────────
  async updateUser(id: string, data: AdminUpdateUserDto): Promise<Partial<User>> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Пользователь не найден');

    if (data.role     !== undefined) user.role     = data.role;
    if (data.isActive !== undefined) user.isActive = data.isActive;

    const saved = await this.userRepo.save(user);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...result } = saved as User & { password: string };
    return result;
  }

  // ── Полное удаление пользователя ───────────────────────────
  async deleteUser(id: string): Promise<void> {
    await this.usersService.purgeUser(id);
  }

  // ── Выдать права администратора ────────────────────────────
  async promote(username: string): Promise<Partial<User>> {
    const user = await this.userRepo.findOne({ where: { username } });
    if (!user) throw new NotFoundException('Пользователь не найден');
    user.role = UserRole.ADMIN;
    const saved = await this.userRepo.save(user);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...result } = saved as User & { password: string };
    return result;
  }

  // ── Глобальные события ─────────────────────────────────────
  getGlobalTasks(): Promise<GlobalTask[]> {
    return this.globalTaskRepo.find({ order: { date: 'ASC' } });
  }

  async createGlobalTask(dto: CreateGlobalTaskDto, adminId: string): Promise<GlobalTask> {
    const task = this.globalTaskRepo.create({
      title:       dto.title,
      description: dto.description ?? null,
      date:        dto.date,
      time:        dto.time        ?? null,
      repeat:      dto.repeat      ?? TaskRepeat.NONE,
      repeatUntil: dto.repeatUntil ?? null,
      icon:        dto.icon?.trim() || null,
      createdBy:   adminId,
    });
    return this.globalTaskRepo.save(task);
  }

  async deleteGlobalTask(id: string): Promise<void> {
    const task = await this.globalTaskRepo.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Событие не найдено');
    await this.globalTaskRepo.remove(task);
  }
}
