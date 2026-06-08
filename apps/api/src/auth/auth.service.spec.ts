import {
  UnauthorizedException,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({ compare: jest.fn(), hash: jest.fn() }));
const bcryptCompare = bcrypt.compare as jest.Mock;
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

// Минимальный пользователь для моков — поля, которыми оперирует сервис.
const makeUser = (over: Partial<User> & { password?: string | null } = {}) =>
  ({
    id: 'u1',
    username: 'tester',
    email: 'tester@example.com',
    role: 'user',
    isActive: true,
    password: 'hashed',
    ...over,
  }) as User & { password?: string | null };

describe('AuthService', () => {
  let service: AuthService;
  let users: jest.Mocked<UsersService>;
  let jwt: jest.Mocked<JwtService>;

  beforeAll(() => {
    // Конструктор падает без секретов — задаём их для всех тестов.
    process.env.JWT_SECRET = 'test-access-secret';
    process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';
  });

  beforeEach(() => {
    users = {
      findByEmailWithPassword: jest.fn(),
      findByUsernameWithPassword: jest.fn(),
      updateLastSeen: jest.fn().mockResolvedValue(undefined),
      grantDailyBonusIfDue: jest.fn().mockResolvedValue(false),
      findById: jest.fn(),
      create: jest.fn(),
      findByGoogleId: jest.fn(),
      createGoogleUser: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    jwt = {
      sign: jest.fn().mockReturnValue('signed-token'),
      verify: jest.fn(),
    } as unknown as jest.Mocked<JwtService>;

    service = new AuthService(users, jwt);
    bcryptCompare.mockReset();
  });

  afterEach(() => jest.restoreAllMocks());

  describe('constructor', () => {
    it('бросает ошибку, если секреты не заданы', () => {
      const saved = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;
      expect(() => new AuthService(users, jwt)).toThrow(/JWT_SECRET/);
      process.env.JWT_SECRET = saved;
    });
  });

  describe('login', () => {
    it('бросает Unauthorized, если пользователь не найден', async () => {
      users.findByUsernameWithPassword.mockResolvedValue(null);
      await expect(
        service.login({ identifier: 'tester', password: 'pwd' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('по email ищет через findByEmailWithPassword', async () => {
      users.findByEmailWithPassword.mockResolvedValue(null);
      await expect(
        service.login({ identifier: 'a@b.com', password: 'pwd' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(users.findByEmailWithPassword).toHaveBeenCalledWith('a@b.com');
      expect(users.findByUsernameWithPassword).not.toHaveBeenCalled();
    });

    it('бросает Unauthorized для деактивированного аккаунта', async () => {
      users.findByUsernameWithPassword.mockResolvedValue(
        makeUser({ isActive: false }),
      );
      await expect(
        service.login({ identifier: 'tester', password: 'pwd' }),
      ).rejects.toThrow('Аккаунт деактивирован');
    });

    it('бросает Unauthorized при неверном пароле', async () => {
      users.findByUsernameWithPassword.mockResolvedValue(makeUser());
      bcryptCompare.mockResolvedValue(false);
      await expect(
        service.login({ identifier: 'tester', password: 'wrong' }),
      ).rejects.toThrow('Неверный логин или пароль');
    });

    it('бросает Unauthorized для Google-аккаунта без пароля', async () => {
      users.findByUsernameWithPassword.mockResolvedValue(
        makeUser({ password: null }),
      );
      await expect(
        service.login({ identifier: 'tester', password: 'pwd' }),
      ).rejects.toThrow('Неверный логин или пароль');
      expect(bcryptCompare).not.toHaveBeenCalled();
    });

    it('успешный вход возвращает пользователя без пароля и токены', async () => {
      users.findByUsernameWithPassword.mockResolvedValue(makeUser());
      bcryptCompare.mockResolvedValue(true);

      const res = await service.login({
        identifier: 'tester',
        password: 'pwd',
      });

      expect(res.user).not.toHaveProperty('password');
      expect(res.tokens).toEqual({
        accessToken: 'signed-token',
        refreshToken: 'signed-token',
      });
      expect(users.updateLastSeen).toHaveBeenCalledWith('u1');
    });

    it('при выданном ежедневном бонусе перечитывает пользователя', async () => {
      users.findByUsernameWithPassword.mockResolvedValue(makeUser());
      users.grantDailyBonusIfDue.mockResolvedValue(true);
      users.findById.mockResolvedValue(makeUser({ id: 'u1' }) as User);
      bcryptCompare.mockResolvedValue(true);

      await service.login({ identifier: 'tester', password: 'pwd' });

      expect(users.findById).toHaveBeenCalledWith('u1');
    });
  });

  describe('register', () => {
    it('возвращает пользователя без пароля и токены', async () => {
      users.create.mockResolvedValue(makeUser() as User);
      const res = await service.register({
        username: 'tester',
        email: 'tester@example.com',
        password: 'pwd',
      } as never);

      expect(res.user).not.toHaveProperty('password');
      expect(res.tokens.accessToken).toBe('signed-token');
    });

    it('пробрасывает ошибки со статусом < 500 (например, конфликт)', async () => {
      users.create.mockRejectedValue(new ConflictException('занято'));
      await expect(
        service.register({
          username: 'tester',
          email: 'tester@example.com',
          password: 'pwd',
        } as never),
      ).rejects.toThrow(ConflictException);
    });

    it('оборачивает неожиданные ошибки в InternalServerError', async () => {
      jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => undefined);
      users.create.mockRejectedValue(new Error('db down'));
      await expect(
        service.register({
          username: 'tester',
          email: 'tester@example.com',
          password: 'pwd',
        } as never),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('refreshTokens', () => {
    it('выдаёт новые токены по валидному refresh-токену', async () => {
      jwt.verify.mockReturnValue({ sub: 'u1' } as never);
      users.findById.mockResolvedValue(makeUser() as User);

      const tokens = await service.refreshTokens('valid');
      expect(tokens.accessToken).toBe('signed-token');
      expect(users.findById).toHaveBeenCalledWith('u1');
    });

    it('бросает Unauthorized при недействительном токене', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('invalid');
      });
      await expect(service.refreshTokens('bad')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('googleComplete', () => {
    it('бросает Unauthorized при истёкшем signup-токене', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('expired');
      });
      await expect(service.googleComplete('tok', 'name')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('бросает Unauthorized при неверном purpose', async () => {
      jwt.verify.mockReturnValue({
        googleId: 'g1',
        email: 'a@b.com',
        purpose: 'wrong',
      } as never);
      await expect(service.googleComplete('tok', 'name')).rejects.toThrow(
        'Недействительный токен',
      );
    });

    it('возвращает существующего пользователя при гонке привязки', async () => {
      jwt.verify.mockReturnValue({
        googleId: 'g1',
        email: 'a@b.com',
        purpose: 'google-signup',
      } as never);
      users.findByGoogleId.mockResolvedValue(makeUser() as User);

      const res = await service.googleComplete('tok', 'name');
      expect(res.user).not.toHaveProperty('password');
      expect(users.createGoogleUser).not.toHaveBeenCalled();
    });

    it('создаёт нового пользователя при выбранном логине', async () => {
      jwt.verify.mockReturnValue({
        googleId: 'g1',
        email: 'a@b.com',
        name: 'Имя',
        picture: 'pic',
        purpose: 'google-signup',
      } as never);
      users.findByGoogleId.mockResolvedValue(null);
      users.createGoogleUser.mockResolvedValue(makeUser() as User);

      const res = await service.googleComplete('tok', '  newname  ');
      expect(users.createGoogleUser).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'newname',
          email: 'a@b.com',
          googleId: 'g1',
        }),
      );
      expect(res.user).not.toHaveProperty('password');
    });
  });
});
