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
import { RemindersModule } from '../reminders/reminders.module';
import { ActivityModule } from '../activity/activity.module';
import { CollabModule } from '../collab/collab.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, TaskCompletion, GlobalTask]),
    TagsModule,
    AchievementsModule,
    NotificationsModule,
    RemindersModule,
    ActivityModule,
    CollabModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
