import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService, AuthResponse, TokenPair, GoogleAuthResult } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleCompleteDto } from './dto/google-complete.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CreateUserDto } from '../users/dto/create-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/register — защита от спама регистраций: 5 попыток / 5 минут с IP
  @Throttle({ default: { ttl: 300_000, limit: 5 } })
  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponse> {
    // RegisterDto совместим с CreateUserDto – поля те же
    return this.authService.register(registerDto as CreateUserDto);
  }

  // POST /auth/login — защита от брутфорса: 10 попыток / 5 минут с IP
  @Throttle({ default: { ttl: 300_000, limit: 10 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(loginDto);
  }

  // POST /auth/google – вход/регистрация по Google access_token
  @Throttle({ default: { ttl: 300_000, limit: 10 } })
  @Post('google')
  @HttpCode(HttpStatus.OK)
  async google(@Body('accessToken') accessToken: string): Promise<GoogleAuthResult> {
    return this.authService.googleAuth(accessToken);
  }

  // POST /auth/google/complete – завершение регистрации (выбран логин)
  @Throttle({ default: { ttl: 300_000, limit: 10 } })
  @Post('google/complete')
  @HttpCode(HttpStatus.OK)
  async googleComplete(@Body() dto: GoogleCompleteDto): Promise<AuthResponse> {
    return this.authService.googleComplete(dto.signupToken, dto.username);
  }

  // POST /auth/refresh
  @Throttle({ default: { ttl: 300_000, limit: 20 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refreshToken') refreshToken: string): Promise<TokenPair> {
    return this.authService.refreshTokens(refreshToken);
  }

  // GET /auth/verify-email?token=...
  @Get('verify-email')
  async verifyEmail(@Query('token') token: string): Promise<{ message: string }> {
    return this.authService.verifyEmail(token);
  }

  // GET /auth/me – проверить текущий токен
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Request() req: Express.Request & { user: unknown }): { user: unknown } {
    return { user: req.user };
  }
}