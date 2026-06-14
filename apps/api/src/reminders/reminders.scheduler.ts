import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ReminderInstance } from './entities/reminder-instance.entity';
import { TaskCompletion } from '../tasks/entities/task-completion.entity';
import { RemindersService } from './reminders.service';
import { PushService } from '../push/push.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class RemindersScheduler {
  private readonly logger = new Logger(RemindersScheduler.name);
  private readonly apiBase: string;

  constructor(
    @InjectRepository(ReminderInstance)
    private readonly repo: Repository<ReminderInstance>,
    @InjectRepository(TaskCompletion)
    private readonly completionRepo: Repository<TaskCompletion>,
    private readonly reminders: RemindersService,
    private readonly push: PushService,
    private readonly notifications: NotificationsService,
    config: ConfigService,
  ) {
    this.apiBase = (
      config.get<string>('API_PUBLIC_URL') ?? 'http://localhost:3001'
    ).replace(/\/$/, '');
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    const due = await this.repo.find({
      where: { fired: false, fireAt: LessThanOrEqual(new Date()) },
      take: 200,
    });
    if (!due.length) return;

    for (const inst of due) {
      try {
        // Отмена для уже выполненного вхождения: не слать, просто пометить fired.
        if (inst.occurrenceDate !== '-') {
          const done = await this.completionRepo.findOne({
            where: {
              taskId: inst.taskId,
              userId: inst.userId,
              date: inst.occurrenceDate,
            },
          });
          if (done) {
            inst.fired = true;
            continue;
          }
        }

        const body = inst.occTime
          ? `${inst.title} — в ${inst.occTime}`
          : inst.title;
        const snoozeToken = this.reminders.signSnoozeToken(inst);
        const doneToken =
          inst.occurrenceDate !== '-'
            ? this.reminders.signDoneToken(inst)
            : undefined;

        await this.push.sendToUser(inst.userId, {
          title: 'Напоминание',
          body,
          icon: 'Bell',
          tag: `reminder-${inst.id}`,
          url: `/?date=${inst.linkDate}`,
          snoozeUrl: `${this.apiBase}/reminders/snooze`,
          doneUrl: doneToken ? `${this.apiBase}/reminders/complete` : undefined,
          snoozeToken,
          doneToken,
        });

        await this.notifications.create({
          userId: inst.userId,
          kind: 'reminder',
          title: `Напоминание: ${inst.title}`,
          body: inst.occTime ? `в ${inst.occTime}` : null,
          icon: 'Bell',
          color: '#f59e0b',
        });

        inst.fired = true;
      } catch (err) {
        this.logger.warn(
          `Не удалось обработать напоминание ${inst.id}: ${String(err)}`,
        );
      }
    }

    await this.repo.save(due);
  }

  /** Раз в сутки чистим давно сработавшие инстансы. */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async prune(): Promise<void> {
    const n = await this.reminders.pruneFired();
    if (n) this.logger.log(`Очищено сработавших напоминаний: ${n}`);
  }
}
