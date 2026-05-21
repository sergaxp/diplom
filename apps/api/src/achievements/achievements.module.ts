import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserAchievement } from './entities/user-achievement.entity';
import { User } from '../users/entities/user.entity';
import { Task } from '../tasks/entities/task.entity';
import { TaskCompletion } from '../tasks/entities/task-completion.entity';
import { Tag } from '../tags/entities/tag.entity';
import { AchievementsService } from './achievements.service';
import { AchievementsController } from './achievements.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserAchievement, User, Task, TaskCompletion, Tag]),
    NotificationsModule,
  ],
  controllers: [AchievementsController],
  providers: [AchievementsService],
  exports: [AchievementsService],
})
export class AchievementsModule {}
