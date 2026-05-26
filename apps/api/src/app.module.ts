import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { StorageModule } from './storage/storage.module';
import { ShopModule } from './shop/shop.module';
import { UserInventory } from './shop/entities/user-inventory.entity';
import { NotificationsModule } from './notifications/notifications.module';
import { Notification } from './notifications/entities/notification.entity';
import { AccountDeletion } from './users/entities/account-deletion.entity';
import { FeedbackModule } from './feedback/feedback.module';
import { BugReport } from './feedback/entities/bug-report.entity';
import { FeatureRequest } from './feedback/entities/feature-request.entity';

@Module({
  imports: [
    // Конфиг – .env доступен везде через process.env
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // База данных
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST ?? 'localhost',
      port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
      username: process.env.DATABASE_USER ?? 'sergey',
      password: process.env.DATABASE_PASSWORD ?? '',
      database: process.env.DATABASE_NAME ?? 'warmingtea_dev',
      entities: [User, Task, TaskCompletion, GlobalTask, Tag, UserAchievement, HolidayCache, UserInventory, Notification, AccountDeletion, BugReport, FeatureRequest],
      synchronize: true, // ⚠️ ТОЛЬКО в DEV! В продакшене – миграции
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
    StorageModule,
    ShopModule,
    NotificationsModule,
    FeedbackModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}