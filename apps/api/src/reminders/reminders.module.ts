import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ReminderInstance } from './entities/reminder-instance.entity';
import { TaskCompletion } from '../tasks/entities/task-completion.entity';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';
import { RemindersScheduler } from './reminders.scheduler';
import { PushModule } from '../push/push.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReminderInstance, TaskCompletion]),
    // Отдельный секрет/TTL для подписанных токенов snooze/done из Service Worker
    JwtModule.register({
      secret:
        process.env.REMINDER_TOKEN_SECRET ??
        'dev-reminder-token-secret-change-me',
      signOptions: { expiresIn: '7d' },
    }),
    PushModule,
    NotificationsModule,
  ],
  controllers: [RemindersController],
  providers: [RemindersService, RemindersScheduler],
  exports: [RemindersService],
})
export class RemindersModule {}
