import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangeEmailDto } from './dto/change-email.dto';
import { AchievementsService } from '../achievements/achievements.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly achievementsService: AchievementsService,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Создание пользователя ──────────────────────────────────
  async create(createUserDto: CreateUserDto): Promise<User> {
    const { username, email, password } = createUserDto;

    // Проверяем уникальность
    const existingUser = await this.usersRepository.findOne({
      where: [{ username }, { email }],
    });

    if (existingUser) {
      if (existingUser.username === username) {
        throw new ConflictException(
          'Пользователь с таким логином уже существует',
        );
      }
      throw new ConflictException(
        'Пользователь с таким email уже существует',
      );
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 12);

    // Создаём пользователя – НЕ устанавливаем displayName здесь
    // чтобы не было конфликта типов string vs string|null
    const user = this.usersRepository.create({
      username,
      email,
      password: hashedPassword,
    });

    const saved = await this.usersRepository.save(user);
    this.logger.log(`Пользователь создан: ${saved.username} (${saved.id})`);
    return saved;
  }

  // ── Google OAuth ───────────────────────────────────────────
  findByGoogleId(googleId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { googleId } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  /** Привязать Google-аккаунт к существующему пользователю */
  async linkGoogle(userId: string, googleId: string): Promise<User> {
    await this.usersRepository.update(userId, { googleId, isEmailVerified: true });
    return this.findById(userId);
  }

  /** Создать пользователя из Google-профиля (без пароля). username уже проверен. */
  async createGoogleUser(data: {
    username: string; email: string; googleId: string;
    displayName?: string | null; avatarUrl?: string | null;
  }): Promise<User> {
    const taken = await this.usersRepository.findOne({
      where: [{ username: data.username }, { email: data.email }],
    });
    if (taken) {
      throw new ConflictException(
        taken.username === data.username
          ? 'Пользователь с таким логином уже существует'
          : 'Пользователь с таким email уже существует',
      );
    }
    const user = this.usersRepository.create({
      username:        data.username,
      email:           data.email,
      googleId:        data.googleId,
      password:        null,
      displayName:     data.displayName ?? null,
      avatarUrl:       data.avatarUrl ?? null,
      isEmailVerified: true,
    });
    const saved = await this.usersRepository.save(user);
    this.logger.log(`Google-пользователь создан: ${saved.username} (${saved.id})`);
    return saved;
  }

  // ── Найти по ID ────────────────────────────────────────────
  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Пользователь не найден');
    return user;
  }

  // ── Найти по username ──────────────────────────────────────
  async findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  // ── Найти по email (с паролем – для аутентификации) ───────
  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  // ── Найти по username (с паролем) ─────────────────────────
  async findByUsernameWithPassword(username: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.username = :username', { username })
      .getOne();
  }

  // ── Обновить профиль ───────────────────────────────────────
  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    if (updateUserDto.username && updateUserDto.username !== user.username) {
      const taken = await this.findByUsername(updateUserDto.username);
      if (taken) throw new ConflictException('Это имя пользователя уже занято');
    }

    // Если меняется selectedFrame – убедимся, что рамка куплена (или null)
    if (
      updateUserDto.selectedFrame !== undefined &&
      updateUserDto.selectedFrame !== null
    ) {
      const owned = await this.usersRepository.manager
        .createQueryBuilder()
        .select('1')
        .from('user_inventory', 'inv')
        .where('inv."userId" = :userId AND inv."itemId" = :itemId', {
          userId: user.id,
          itemId: updateUserDto.selectedFrame,
        })
        .getRawOne();
      if (!owned) {
        throw new BadRequestException('Эта рамка не куплена');
      }
    }

    // Применяем только явно переданные поля (фильтруем undefined от class-transformer)
    const patch = Object.fromEntries(
      Object.entries(updateUserDto).filter(([, v]) => v !== undefined),
    );
    Object.assign(user, patch);
    const saved = await this.usersRepository.save(user);
    await this.achievementsService.checkAndUnlock(saved.id, {
      type:        'profile_updated',
      displayName: saved.displayName,
      avatarUrl:   saved.avatarUrl,
      bio:         saved.bio,
    });
    return saved;
  }

  // ── Обновить аватар ────────────────────────────────────────
  async updateAvatar(id: string, avatarUrl: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new BadRequestException('Пользователь не найден');
    user.avatarUrl = avatarUrl;
    const saved = await this.usersRepository.save(user);
    await this.achievementsService.checkAndUnlock(saved.id, {
      type:        'profile_updated',
      displayName: saved.displayName,
      avatarUrl:   saved.avatarUrl,
      bio:         saved.bio,
    });
    return saved;
  }

  // ── Обновить баннер ────────────────────────────────────────
  async updateCover(id: string, coverUrl: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new BadRequestException('Пользователь не найден');
    user.coverUrl = coverUrl;
    return this.usersRepository.save(user);
  }

  // ── Обновить lastSeenAt ────────────────────────────────────
  async updateLastSeen(id: string): Promise<void> {
    await this.usersRepository.update(id, { lastSeenAt: new Date() });
  }

  /** Публичная статистика для лендинга:
   *  totalUsers – всего активных аккаунтов,
   *  onlineUsers – пользователи с lastSeenAt за последние 5 минут,
   *  deletedToday – количество удалённых сегодня аккаунтов. */
  async getPublicStats(): Promise<{ totalUsers: number; onlineUsers: number; deletedToday: number }> {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const [totalUsers, onlineUsers, deletedToday] = await Promise.all([
      this.usersRepository.count({ where: { isActive: true } }),
      this.usersRepository
        .createQueryBuilder('u')
        .where('u.isActive = :a', { a: true })
        .andWhere('u.lastSeenAt >= :since', { since: fiveMinAgo })
        .getCount(),
      this.deletedToday(),
    ]);
    return { totalUsers, onlineUsers, deletedToday };
  }

  /** Начислить ежедневный бонус (1 монетка), если ещё не начисляли сегодня.
   *  Возвращает true, если бонус был выдан. */
  async grantDailyBonusIfDue(id: string): Promise<boolean> {
    const user = await this.usersRepository.findOne({
      where: { id },
      select: ['id', 'lastDailyBonusAt'],
    });
    if (!user) return false;

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const last  = user.lastDailyBonusAt ? new Date(user.lastDailyBonusAt) : null;
    if (last) last.setHours(0, 0, 0, 0);

    if (last && last.getTime() === today.getTime()) return false;

    await this.usersRepository.update(id, {
      lastDailyBonusAt: new Date(),
    });
    await this.usersRepository.increment({ id }, 'coins', 1);
    await this.notifications.create({
      userId: id,
      kind:   'daily_bonus',
      title:  'Ежедневный бонус: +1 монета',
      body:   'Спасибо, что вернулись! Загляните в магазин.',
      icon:   'Coins',
      color:  '#eab308',
    }).catch(() => { /* ignore */ });
    return true;
  }

  // ── Смена пароля ───────────────────────────────────────────
  async changePassword(id: string, dto: ChangePasswordDto): Promise<void> {
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Новый пароль должен отличаться от текущего');
    }
    const user = await this.usersRepository
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.id = :id', { id })
      .getOne();
    if (!user) throw new NotFoundException('Пользователь не найден');

    const valid = user.password
      ? await bcrypt.compare(dto.currentPassword, user.password)
      : false;
    if (!valid) throw new UnauthorizedException('Неверный текущий пароль');

    const hashed = await bcrypt.hash(dto.newPassword, 12);
    await this.usersRepository.update(id, { password: hashed });
  }

  // ── Смена email ────────────────────────────────────────────
  async changeEmail(id: string, dto: ChangeEmailDto): Promise<User> {
    const user = await this.usersRepository
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.id = :id', { id })
      .getOne();
    if (!user) throw new NotFoundException('Пользователь не найден');

    const valid = user.password ? await bcrypt.compare(dto.password, user.password) : false;
    if (!valid) throw new UnauthorizedException('Неверный пароль');

    if (user.email === dto.newEmail) {
      throw new BadRequestException('Это уже ваш текущий email');
    }
    const exists = await this.usersRepository.findOne({ where: { email: dto.newEmail } });
    if (exists) throw new ConflictException('Этот email уже используется');

    user.email = dto.newEmail;
    user.isEmailVerified = false;
    const saved = await this.usersRepository.save(user);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pw, ...rest } = saved as User & { password?: string };
    return rest as User;
  }

  // ── Удаление аккаунта ──────────────────────────────────────
  async deleteAccount(id: string, password: string): Promise<void> {
    const user = await this.usersRepository
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.id = :id', { id })
      .getOne();
    if (!user) throw new NotFoundException('Пользователь не найден');

    const valid = user.password ? await bcrypt.compare(password, user.password) : false;
    if (!valid) throw new UnauthorizedException('Неверный пароль');

    await this.purgeUser(id);
  }

  /**
   * Полностью удаляет пользователя и все связанные данные.
   * Без проверки пароля — для самоудаления используйте deleteAccount,
   * для удаления из админ-панели вызывается напрямую.
   */
  async purgeUser(id: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Пользователь не найден');

    const usernameHint = user.username;
    // Каскадно очищаем связанные записи. Используем транзакцию.
    await this.dataSource.transaction(async (em) => {
      // task_completions → task_tags → tasks/tags/achievement/inventory
      await em.query('DELETE FROM task_completions WHERE "userId" = $1', [id]);
      await em.query(
        'DELETE FROM task_tags WHERE "taskId" IN (SELECT id FROM tasks WHERE "userId" = $1)',
        [id],
      );
      await em.query('DELETE FROM tasks WHERE "userId" = $1', [id]);
      await em.query('DELETE FROM tags WHERE "userId" = $1', [id]);
      await em.query('DELETE FROM user_achievements WHERE "userId" = $1', [id]);
      await em.query('DELETE FROM user_inventory WHERE "userId" = $1', [id]);
      await em.query('DELETE FROM notifications WHERE "userId" = $1', [id]);
      await em.query('DELETE FROM users WHERE id = $1', [id]);

      // Записываем факт удаления для публичной статистики
      await em.query(
        'INSERT INTO account_deletion ("usernameHint") VALUES ($1)',
        [usernameHint],
      );
    });
    this.logger.log(`Пользователь удалён: ${usernameHint} (${id})`);
  }

  /** Сколько аккаунтов было удалено сегодня (с 00:00 локального времени). */
  async deletedToday(): Promise<number> {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const res = await this.dataSource
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('account_deletion', 'd')
      .where('d."deletedAt" >= :since', { since: start })
      .getRawOne<{ count: string }>();
    return res ? parseInt(res.count, 10) : 0;
  }

  // ── Верификация email ──────────────────────────────────────
  async verifyEmail(token: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { emailVerificationToken: token },
    });
    if (!user) throw new NotFoundException('Токен верификации недействителен');

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    return this.usersRepository.save(user);
  }

  // ── Публичный профиль ──────────────────────────────────────
  async getPublicProfile(username: string): Promise<Partial<User> & { level: number }> {
    const user = await this.usersRepository.findOne({
      where: { username, isActive: true },
      select: ['id', 'username', 'displayName', 'avatarUrl', 'coverUrl', 'bio', 'location', 'createdAt', 'xp', 'selectedFrame', 'socialLinks'],
    });
    if (!user) throw new NotFoundException('Пользователь не найден');
    return { ...user, level: Math.floor((user.xp ?? 0) / 1000) };
  }
}
