import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /users/me — профиль текущего пользователя
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req) {
    return this.usersService.findById(req.user.id);
  }

  // PATCH /users/me — обновление своего профиля
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(req.user.id, updateUserDto);
  }

  // GET /users/:username — публичный профиль пользователя
  @Get(':username')
  async getPublicProfile(@Param('username') username: string) {
    return this.usersService.getPublicProfile(username);
  }
}
