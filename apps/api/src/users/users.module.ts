import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { StorageModule } from '../storage/storage.module';
import { AchievementsModule } from '../achievements/achievements.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), StorageModule, AchievementsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
