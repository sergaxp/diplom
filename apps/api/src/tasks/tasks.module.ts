import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './entities/task.entity';
import { TaskCompletion } from './entities/task-completion.entity';
import { GlobalTask } from './entities/global-task.entity';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TagsModule } from '../tags/tags.module';
import { AchievementsModule } from '../achievements/achievements.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, TaskCompletion, GlobalTask]),
    TagsModule,
    AchievementsModule,
    NotificationsModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
