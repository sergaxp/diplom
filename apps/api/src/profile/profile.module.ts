import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { Post } from './entities/post.entity';
import { Comment } from './entities/comment.entity';
import { UsersModule } from '../users/users.module';
import { ShopModule } from '../shop/shop.module';
import { AchievementsModule } from '../achievements/achievements.module';
import { StorageModule } from '../storage/storage.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post, Comment]),
    UsersModule,
    ShopModule,
    AchievementsModule,
    StorageModule,
    ActivityModule,
  ],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
