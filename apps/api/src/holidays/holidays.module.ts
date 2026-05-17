import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HolidayCache } from './entities/holiday-cache.entity';
import { HolidaysService } from './holidays.service';
import { HolidaysController } from './holidays.controller';

@Module({
  imports: [TypeOrmModule.forFeature([HolidayCache])],
  providers: [HolidaysService],
  controllers: [HolidaysController],
})
export class HolidaysModule {}
