import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { ActivityEvent } from './entities/activity-event.entity';
import { DayCount, LogActivityInput } from './activity.types';

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    @InjectRepository(ActivityEvent)
    private readonly repo: Repository<ActivityEvent>,
  ) {}

  /**
   * Записать событие. Best-effort: журнал — побочный эффект, его падение не
   * должно ломать основную операцию (создание/правку задачи). Поэтому ошибку
   * глотаем и логируем, наружу не пробрасываем.
   */
  async log(input: LogActivityInput): Promise<void> {
    try {
      await this.repo.insert({
        userId: input.userId,
        projectId: input.projectId ?? null,
        taskId: input.taskId ?? null,
        type: input.type,
        summary: input.summary,
        meta: input.meta ?? null,
      });
    } catch (e) {
      this.logger.warn(`Не удалось записать активность: ${String(e)}`);
    }
  }

  /** Активность проекта: клетки heatmap за период + лента событий (новые сверху). */
  async projectActivity(
    userId: string,
    projectId: string,
    from: Date,
    to: Date,
  ): Promise<{ days: DayCount[]; events: ActivityEvent[] }> {
    const [days, events] = await Promise.all([
      this.dailyCounts({ userId, projectId }, from, to),
      this.repo.find({
        where: { userId, projectId, createdAt: Between(from, to) },
        order: { createdAt: 'DESC' },
        take: 500,
      }),
    ]);
    return { days, events };
  }

  /** Глобальные клетки heatmap пользователя за период (для витрины профиля). */
  userDailyCounts(userId: string, from: Date, to: Date): Promise<DayCount[]> {
    return this.dailyCounts({ userId }, from, to);
  }

  /** Группировка событий по локальной дате (YYYY-MM-DD). Postgres-only. */
  private async dailyCounts(
    scope: { userId: string; projectId?: string },
    from: Date,
    to: Date,
  ): Promise<DayCount[]> {
    const qb = this.repo
      .createQueryBuilder('a')
      .select(`to_char("a"."createdAt", 'YYYY-MM-DD')`, 'date')
      .addSelect('COUNT(*)', 'count')
      .where('a.userId = :userId', { userId: scope.userId })
      .andWhere('a.createdAt BETWEEN :from AND :to', { from, to });
    if (scope.projectId) {
      qb.andWhere('a.projectId = :projectId', { projectId: scope.projectId });
    }
    const rows = await qb
      .groupBy('date')
      .orderBy('date', 'ASC')
      .getRawMany<{ date: string; count: string }>();
    return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
  }
}
