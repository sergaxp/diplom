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
import { User } from './users/entities/user.entity';
import { Task } from './tasks/entities/task.entity';
import { TaskCompletion } from './tasks/entities/task-completion.entity';
import { GlobalTask } from './tasks/entities/global-task.entity';
import { Tag } from './tags/entities/tag.entity';

@Module({
  imports: [
    // Конфиг — .env доступен везде через process.env
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
      entities: [User, Task, TaskCompletion, GlobalTask, Tag],
      synchronize: true, // ⚠️ ТОЛЬКО в DEV! В продакшене — миграции
      logging: process.env.NODE_ENV === 'development',
    }),

    // Модули приложения
    UsersModule,
    AuthModule,
    TasksModule,
    AdminModule,
    TagsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}