import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { UserRole } from '../../users/entities/user.entity';

interface JwtPayload {
  sub: string;
  username: string;
  role: UserRole;
}

export interface JwtUser {
  id: string;
  username: string;
  role: UserRole;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private usersService: UsersService) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      // Пустой secretOrKey предсказуем и позволил бы подделывать JWT — лучше упасть на старте
      throw new Error('JWT_SECRET должен быть задан в переменных окружения');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtUser> {
    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        'Пользователь не найден или деактивирован',
      );
    }

    return { id: user.id, username: user.username, role: user.role };
  }
}
