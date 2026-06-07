import {
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import type { SignOptions } from 'jsonwebtoken';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '../users/entities/user.entity';

// Срок действия токена задаётся строкой из env (например, "15m", "7d") — формат
// проверяет сам jsonwebtoken при подписи; здесь только приводим тип к ожидаемому.
type ExpiresIn = SignOptions['expiresIn'];
const asExpiresIn = (value: string): ExpiresIn => value as ExpiresIn;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: Omit<User, 'password'>;
  tokens: TokenPair;
}

export interface GoogleAuthResult {
  // Либо сразу вход (существующий/привязанный аккаунт)…
  user?: Omit<User, 'password'>;
  tokens?: TokenPair;
  // …либо новый пользователь — нужно выбрать логин
  needsUsername?: boolean;
  signupToken?: string;
  suggestedName?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
  );

  // Секреты подписи токенов — обязательны, без fallback на дефолтные значения:
  // предсказуемый секрет в проде позволил бы подделывать JWT.
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiresIn: ExpiresIn;
  private readonly refreshExpiresIn: ExpiresIn;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {
    const accessSecret = process.env.JWT_SECRET;
    const refreshSecret = process.env.REFRESH_TOKEN_SECRET;
    if (!accessSecret || !refreshSecret) {
      throw new Error(
        'JWT_SECRET и REFRESH_TOKEN_SECRET должны быть заданы в переменных окружения — без них подпись токенов небезопасна',
      );
    }
    this.accessSecret = accessSecret;
    this.refreshSecret = refreshSecret;
    this.accessExpiresIn = asExpiresIn(process.env.JWT_EXPIRES_IN ?? '15m');
    this.refreshExpiresIn = asExpiresIn(
      process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d',
    );
  }

  // ── Вход/регистрация через Google ──────────────────────────
  // Принимаем access_token (OAuth token flow от кастомной кнопки на фронте).
  async googleAuth(accessToken: string): Promise<GoogleAuthResult> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId)
      throw new InternalServerErrorException('Google-вход не настроен');
    if (!accessToken)
      throw new UnauthorizedException('Не передан токен Google');

    // 1) Проверяем токен и что он выдан именно нашему приложению
    let info: { aud?: string; sub?: string; email?: string };
    try {
      info = await this.googleClient.getTokenInfo(accessToken);
    } catch {
      throw new UnauthorizedException('Недействительный токен Google');
    }
    if (info.aud !== clientId) {
      throw new UnauthorizedException('Токен выдан другому приложению');
    }
    const googleId = info.sub;
    const email = info.email?.toLowerCase();
    if (!googleId || !email) {
      throw new UnauthorizedException('Google не вернул данные аккаунта');
    }

    // 2) Профиль (имя/аватар) — необязательно
    let name = '';
    let picture = '';
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const u = (await res.json()) as { name?: string; picture?: string };
        name = u.name ?? '';
        picture = u.picture ?? '';
      }
    } catch {
      /* профиль необязателен */
    }

    // 1) Уже входил через Google
    let user = await this.usersService.findByGoogleId(googleId);
    // 2) Есть аккаунт с таким email — привязываем Google к нему
    if (!user) {
      const byEmail = await this.usersService.findByEmail(email);
      if (byEmail)
        user = await this.usersService.linkGoogle(byEmail.id, googleId);
    }

    if (user) {
      if (!user.isActive)
        throw new UnauthorizedException('Аккаунт деактивирован');
      await this.usersService.updateLastSeen(user.id);
      await this.usersService.grantDailyBonusIfDue(user.id);
      const fresh = await this.usersService.findById(user.id);
      return {
        user: this.stripPassword(fresh),
        tokens: this.generateTokens(fresh),
      };
    }

    // 3) Новый пользователь — просим выбрать логин (аккаунт пока не создаём)
    const signupToken = this.jwtService.sign(
      { googleId, email, name, picture, purpose: 'google-signup' },
      { secret: this.signupSecret(), expiresIn: 900 },
    );
    return { needsUsername: true, signupToken, suggestedName: name };
  }

  // ── Завершение регистрации через Google (выбран логин) ─────
  async googleComplete(
    signupToken: string,
    username: string,
  ): Promise<AuthResponse> {
    let data: {
      googleId: string;
      email: string;
      name?: string;
      picture?: string;
      purpose: string;
    };
    try {
      data = this.jwtService.verify(signupToken, {
        secret: this.signupSecret(),
      });
    } catch {
      throw new UnauthorizedException(
        'Сессия регистрации истекла — войдите через Google заново',
      );
    }
    if (data.purpose !== 'google-signup')
      throw new UnauthorizedException('Недействительный токен');

    // На случай гонки: аккаунт мог быть уже создан/привязан
    const already = await this.usersService.findByGoogleId(data.googleId);
    if (already) {
      return {
        user: this.stripPassword(already),
        tokens: this.generateTokens(already),
      };
    }

    const user = await this.usersService.createGoogleUser({
      username: username.trim(),
      email: data.email,
      googleId: data.googleId,
      displayName: data.name || null,
      avatarUrl: data.picture || null,
    });
    return {
      user: this.stripPassword(user),
      tokens: this.generateTokens(user),
    };
  }

  private signupSecret(): string {
    return this.accessSecret + '_gsignup';
  }

  // ── Регистрация ─────────────────────────────────────────────
  async register(createUserDto: CreateUserDto): Promise<AuthResponse> {
    try {
      const user = await this.usersService.create(createUserDto);
      const tokens = this.generateTokens(user);
      return { user: this.stripPassword(user), tokens };
    } catch (err) {
      // Пробрасываем ConflictException как есть (409), логируем остальное
      const status =
        err instanceof Object && 'status' in err
          ? (err as { status?: number }).status
          : undefined;
      if (status !== undefined && status < 500) throw err;
      this.logger.error(
        'Ошибка регистрации:',
        (err as Error).message,
        (err as Error).stack,
      );
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

    const userWithPwd = user as User & { password: string | null };
    // У Google-аккаунтов пароля нет — вход по паролю для них недоступен
    const valid = userWithPwd.password
      ? await bcrypt.compare(password, userWithPwd.password)
      : false;
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
      const payload = this.jwtService.verify<{ sub: string }>(refreshToken, {
        secret: this.refreshSecret,
      });
      const user = await this.usersService.findById(payload.sub);
      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Refresh токен недействителен или истёк');
    }
  }

  // ── Генерация токенов ───────────────────────────────────────
  private generateTokens(user: User): TokenPair {
    const payload = { sub: user.id, username: user.username, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.accessSecret,
      expiresIn: this.accessExpiresIn,
    });
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.refreshSecret,
      expiresIn: this.refreshExpiresIn,
    });

    return { accessToken, refreshToken };
  }

  // ── Убираем пароль из объекта пользователя ─────────────────
  private stripPassword(user: User): Omit<User, 'password'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...rest } = user as User & { password?: string };
    return rest as Omit<User, 'password'>;
  }
}
