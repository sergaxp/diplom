import { Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { HolidaysService } from './holidays.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('holidays')
@UseGuards(JwtAuthGuard)
export class HolidaysController {
  constructor(private readonly svc: HolidaysService) {}

  @Get(':year')
  getByYear(@Param('year', ParseIntPipe) year: number) {
    return this.svc.getByYear(year);
  }

  /** Принудительный сброс кеша (только для авторизованных) */
  @Post(':year/refresh')
  refreshYear(@Param('year', ParseIntPipe) year: number) {
    return this.svc.refreshYear(year);
  }
}
