import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ReminderInstance } from './entities/reminder-instance.entity';
import { TaskCompletion } from '../tasks/entities/task-completion.entity';
import { SyncInstanceDto } from './dto/sync-reminders.dto';

interface SnoozeTokenPayload {
  kind: 'snooze';
  instanceId: string;
  userId: string;
}

interface DoneTokenPayload {
  kind: 'done';
  taskId: string;
  userId: string;
  occurrenceDate: string;
}

const PRUNE_DAYS = 30;

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    @InjectRepository(ReminderInstance)
    private readonly repo: Repository<ReminderInstance>,
    @InjectRepository(TaskCompletion)
    private readonly completionRepo: Repository<TaskCompletion>,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Заменяет будущие нефайренные инстансы задачи присланными клиентом.
   * Прошлые/уже сработавшие и snooze-копии не трогает.
   */
  async syncForTask(
    userId: string,
    taskId: string,
    instances: SyncInstanceDto[],
  ): Promise<void> {
    await this.repo.manager.transaction(async (m) => {
      await m
        .createQueryBuilder()
        .delete()
        .from(ReminderInstance)
        .where(
          'taskId = :taskId AND userId = :userId AND fired = false AND fireAt > :now AND ruleId NOT LIKE :sn',
          { taskId, userId, now: new Date(), sn: 'snooze:%' },
        )
        .execute();

      for (const inst of instances) {
        await m
          .createQueryBuilder()
          .insert()
          .into(ReminderInstance)
          .values({
            userId,
            taskId,
            ruleId: inst.ruleId,
            occurrenceDate: inst.occurrenceDate,
            linkDate: inst.linkDate,
            fireAt: new Date(inst.fireAt),
            title: inst.title,
            occTime: inst.occTime ?? null,
            fired: false,
          })
          // не воскрешаем уже сработавшие/существующие (ON CONFLICT DO NOTHING)
          .orIgnore()
          .execute();
      }
    });
  }

  async deleteForTask(taskId: string): Promise<void> {
    await this.repo.delete({ taskId });
  }

  /** Чистит давно сработавшие инстансы. */
  async pruneFired(): Promise<number> {
    const cutoff = new Date(Date.now() - PRUNE_DAYS * 86_400_000);
    const res = await this.repo.delete({
      fired: true,
      fireAt: LessThan(cutoff),
    });
    return res.affected ?? 0;
  }

  // ── Подписанные токены для действий из Service Worker ────────────

  signSnoozeToken(inst: ReminderInstance): string {
    const payload: SnoozeTokenPayload = {
      kind: 'snooze',
      instanceId: inst.id,
      userId: inst.userId,
    };
    return this.jwt.sign(payload);
  }

  signDoneToken(inst: ReminderInstance): string {
    const payload: DoneTokenPayload = {
      kind: 'done',
      taskId: inst.taskId,
      userId: inst.userId,
      occurrenceDate: inst.occurrenceDate,
    };
    return this.jwt.sign(payload);
  }

  /** Откладывает напоминание на N минут (создаёт snooze-копию инстанса). */
  async snooze(token: string, minutes: number): Promise<void> {
    let payload: SnoozeTokenPayload;
    try {
      payload = this.jwt.verify<SnoozeTokenPayload>(token);
    } catch {
      return;
    }
    if (payload.kind !== 'snooze') return;

    const orig = await this.repo.findOne({
      where: { id: payload.instanceId, userId: payload.userId },
    });
    if (!orig) return;

    const fireAt = new Date(Date.now() + Math.max(1, minutes) * 60_000);
    const snoozeRuleId = `snooze:${orig.ruleId}`;
    const existing = await this.repo.findOne({
      where: {
        taskId: orig.taskId,
        ruleId: snoozeRuleId,
        occurrenceDate: orig.occurrenceDate,
      },
    });
    if (existing) {
      existing.fireAt = fireAt;
      existing.fired = false;
      existing.title = orig.title;
      existing.occTime = orig.occTime;
      existing.linkDate = orig.linkDate;
      await this.repo.save(existing);
      return;
    }
    await this.repo.save(
      this.repo.create({
        userId: orig.userId,
        taskId: orig.taskId,
        ruleId: snoozeRuleId,
        occurrenceDate: orig.occurrenceDate,
        linkDate: orig.linkDate,
        fireAt,
        title: orig.title,
        occTime: orig.occTime,
        fired: false,
      }),
    );
  }

  /** Отмечает вхождение выполненным (идемпотентно). */
  async complete(token: string): Promise<void> {
    let payload: DoneTokenPayload;
    try {
      payload = this.jwt.verify<DoneTokenPayload>(token);
    } catch {
      return;
    }
    if (payload.kind !== 'done' || payload.occurrenceDate === '-') return;

    const existing = await this.completionRepo.findOne({
      where: {
        taskId: payload.taskId,
        userId: payload.userId,
        date: payload.occurrenceDate,
      },
    });
    if (existing) return;

    await this.completionRepo.save(
      this.completionRepo.create({
        taskId: payload.taskId,
        userId: payload.userId,
        date: payload.occurrenceDate,
      }),
    );
  }
}
