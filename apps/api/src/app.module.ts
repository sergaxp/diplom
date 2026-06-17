import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { TasksModule } from './tasks/tasks.module';
import { AdminModule } from './admin/admin.module';
import { TagsModule } from './tags/tags.module';
import { AchievementsModule } from './achievements/achievements.module';
import { User } from './users/entities/user.entity';
import { Task } from './tasks/entities/task.entity';
import { TaskCompletion } from './tasks/entities/task-completion.entity';
import { GlobalTask } from './tasks/entities/global-task.entity';
import { Tag } from './tags/entities/tag.entity';
import { UserAchievement } from './achievements/entities/user-achievement.entity';
import { HolidayCache } from './holidays/entities/holiday-cache.entity';
import { HolidaysModule } from './holidays/holidays.module';
import { WeatherModule } from './weather/weather.module';
import { StorageModule } from './storage/storage.module';
import { ShopModule } from './shop/shop.module';
import { UserInventory } from './shop/entities/user-inventory.entity';
import { NotificationsModule } from './notifications/notifications.module';
import { Notification } from './notifications/entities/notification.entity';
import { AccountDeletion } from './users/entities/account-deletion.entity';
import { FeedbackModule } from './feedback/feedback.module';
import { BugReport } from './feedback/entities/bug-report.entity';
import { FeatureRequest } from './feedback/entities/feature-request.entity';
import { ProfileModule } from './profile/profile.module';
import { Post } from './profile/entities/post.entity';
import { Comment } from './profile/entities/comment.entity';
import { PushModule } from './push/push.module';
import { PushSubscription } from './push/entities/push-subscription.entity';
import { RemindersModule } from './reminders/reminders.module';
import { ReminderInstance } from './reminders/entities/reminder-instance.entity';
import { BoardModule } from './board/board.module';
import { BoardPlacement } from './board/entities/board-placement.entity';
import { ProjectsModule } from './projects/projects.module';
import { Project } from './projects/entities/project.entity';
import { ProjectBoardPlacement } from './projects/entities/project-board-placement.entity';
import { ActivityModule } from './activity/activity.module';
import { ActivityEvent } from './activity/entities/activity-event.entity';
import { CollabModule } from './collab/collab.module';
import { TaskCollaborator } from './collab/entities/task-collaborator.entity';
import { ProjectCollaborator } from './collab/entities/project-collaborator.entity';
import { CollabComment } from './collab/entities/collab-comment.entity';

@Module({
  imports: [
    // Конфиг – .env доступен везде через process.env
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // Планировщик cron-задач (напоминания тикают раз в минуту)
    ScheduleModule.forRoot(),

    // Глобальный рейт-лимит: 100 запросов / минуту с одного IP по умолчанию
    // (отдельные эндпоинты — например /auth/* — переопределяют лимит через @Throttle)
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),

    // База данных
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST ?? 'localhost',
      port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
      username: process.env.DATABASE_USER ?? 'sergey',
      password: process.env.DATABASE_PASSWORD ?? '',
      database: process.env.DATABASE_NAME ?? 'warmingtea_dev',
      entities: [
        User,
        Task,
        TaskCompletion,
        GlobalTask,
        Tag,
        UserAchievement,
        HolidayCache,
        UserInventory,
        Notification,
        AccountDeletion,
        BugReport,
        FeatureRequest,
        Post,
        Comment,
        PushSubscription,
        ReminderInstance,
        BoardPlacement,
        Project,
        ProjectBoardPlacement,
        ActivityEvent,
        TaskCollaborator,
        ProjectCollaborator,
        CollabComment,
      ],
      synchronize: process.env.NODE_ENV !== 'production', // в проде схему накатывают миграции (см. src/migrations)
      migrations: [__dirname + '/migrations/*{.ts,.js}'],
      migrationsRun: process.env.NODE_ENV === 'production',
      logging: process.env.NODE_ENV === 'development',
    }),

    // Модули приложения
    UsersModule,
    AuthModule,
    TasksModule,
    AdminModule,
    TagsModule,
    AchievementsModule,
    HolidaysModule,
    WeatherModule,
    StorageModule,
    ShopModule,
    NotificationsModule,
    FeedbackModule,
    ProfileModule,
    PushModule,
    RemindersModule,
    BoardModule,
    ProjectsModule,
    ActivityModule,
    CollabModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
