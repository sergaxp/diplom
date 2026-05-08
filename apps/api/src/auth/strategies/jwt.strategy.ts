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

interface JwtUser {
  id: string;
  username: string;
  role: UserRole;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private usersService: UsersService) {
    // ?? '' гарантирует что secretOrKey всегда string, а не undefined
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? '',
    });
  }

  async validate(payload: JwtPayload): Promise<JwtUser> {
    const user = await this.usersService.findById(payload.sub);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Пользователь не найден или деактивирован');
    }

    return { id: user.id, username: user.username, role: user.role };
  }
}