import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
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

    // Создаём пользователя — НЕ устанавливаем displayName здесь
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

  // ── Найти по email (с паролем — для аутентификации) ───────
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
    Object.assign(user, updateUserDto);
    return this.usersRepository.save(user);
  }

  // ── Обновить lastSeenAt ────────────────────────────────────
  async updateLastSeen(id: string): Promise<void> {
    await this.usersRepository.update(id, { lastSeenAt: new Date() });
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
  async getPublicProfile(username: string): Promise<Partial<User>> {
    const user = await this.usersRepository.findOne({
      where: { username, isActive: true },
      select: [
        'id',
        'username',
        'displayName',
        'avatarUrl',
        'coverUrl',
        'bio',
        'createdAt',
      ],
    });
    if (!user) throw new NotFoundException('Пользователь не найден');
    return user;
  }
}
