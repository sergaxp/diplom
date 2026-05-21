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
import { AuthService, AuthResponse, TokenPair } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CreateUserDto } from '../users/dto/create-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/register
  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponse> {
    // RegisterDto совместим с CreateUserDto – поля те же
    return this.authService.register(registerDto as CreateUserDto);
  }

  // POST /auth/login
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(loginDto);
  }

  // POST /auth/refresh
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