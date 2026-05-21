import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: Omit<User, 'password'>;
  tokens: TokenPair;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  // ── Регистрация ─────────────────────────────────────────────
  async register(createUserDto: CreateUserDto): Promise<AuthResponse> {
    try {
      const user = await this.usersService.create(createUserDto);
      const tokens = this.generateTokens(user);
      return { user: this.stripPassword(user), tokens };
    } catch (err) {
      // Пробрасываем ConflictException как есть (409), логируем остальное
      if ((err as any).status && (err as any).status < 500) throw err;
      this.logger.error('Ошибка регистрации:', (err as Error).message, (err as Error).stack);
      throw new InternalServerErrorException('Ошибка при создании аккаунта');
    }
  }

  // ── Вход ───────────────────────────────────────────────────
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { identifier, password } = loginDto;
    const isEmail = identifier.includes('@');

    const user = isEmail
      ? await this.usersService.findByEmailWithPassword(identifier)
      : await this.usersService.findByUsernameWithPassword(identifier);

    if (!user) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Аккаунт деактивирован');
    }

    const userWithPwd = user as User & { password: string };
    const valid = await bcrypt.compare(password, userWithPwd.password);
    if (!valid) {
      throw new UnauthorizedException('Неверный логин или пароль');
    }

    await this.usersService.updateLastSeen(user.id);
    // Ежедневный бонус за вход – 1 монетка, если ещё не выдавали сегодня
    const bonusGranted = await this.usersService.grantDailyBonusIfDue(user.id);
    if (bonusGranted) {
      // Перечитываем пользователя, чтобы вернуть свежие coins/lastDailyBonusAt
      const refreshed = await this.usersService.findById(user.id);
      const tokens = this.generateTokens(refreshed);
      return { user: this.stripPassword(refreshed), tokens };
    }
    const tokens = this.generateTokens(user);
    return { user: this.stripPassword(user), tokens };
  }

  // ── Верификация email ───────────────────────────────────────
  async verifyEmail(token: string): Promise<{ message: string }> {
    await this.usersService.verifyEmail(token);
    return { message: 'Email успешно подтверждён' };
  }

  // ── Обновление токенов ──────────────────────────────────────
  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    try {
      const secret = process.env.JWT_REFRESH_SECRET ?? '';
      const payload = this.jwtService.verify<{ sub: string }>(refreshToken, { secret });
      const user = await this.usersService.findById(payload.sub);
      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Refresh токен недействителен или истёк');
    }
  }

  // ── Генерация токенов ───────────────────────────────────────
  private generateTokens(user: User): TokenPair {
    const payload = { sub: user.id, username: user.username, role: user.role };
    const accessSecret  = process.env.JWT_SECRET ?? 'fallback-dev-secret';
    const refreshSecret = process.env.JWT_REFRESH_SECRET ?? 'fallback-dev-refresh-secret';

    // expiresIn – число секунд
    const accessToken  = this.jwtService.sign(payload, { secret: accessSecret,  expiresIn: 86400 });   // 24h
    const refreshToken = this.jwtService.sign(payload, { secret: refreshSecret, expiresIn: 2592000 }); // 30d

    return { accessToken, refreshToken };
  }

  // ── Убираем пароль из объекта пользователя ─────────────────
  private stripPassword(user: User): Omit<User, 'password'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...rest } = user as User & { password?: string };
    return rest as Omit<User, 'password'>;
  }
}
