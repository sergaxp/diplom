import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WeatherService } from './weather.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('weather')
@ApiBearerAuth()
@Controller('weather')
@UseGuards(JwtAuthGuard)
export class WeatherController {
  constructor(private readonly svc: WeatherService) {}

  @Get('forecast')
  forecast(@Query() q: Record<string, string>) {
    return this.svc.forecast(q);
  }

  @Get('archive')
  archive(@Query() q: Record<string, string>) {
    return this.svc.archive(q);
  }
}
