import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityEvent } from './entities/activity-event.entity';
import { ActivityService } from './activity.service';

/**
 * Журнал активности. Сервис экспортируется, чтобы tasks/projects/profile могли
 * писать события и читать агрегаты. Сам модуль не зависит от tasks/projects —
 * только репозиторий ActivityEvent (нет циклов).
 */
@Module({
  imports: [TypeOrmModule.forFeature([ActivityEvent])],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}
