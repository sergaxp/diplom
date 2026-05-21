import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { UserAchievement } from './entities/user-achievement.entity';
import { User } from '../users/entities/user.entity';
import { Task } from '../tasks/entities/task.entity';
import { TaskCompletion } from '../tasks/entities/task-completion.entity';
import { Tag } from '../tags/entities/tag.entity';
import { ACHIEVEMENTS, ACHIEVEMENT_MAP, AchievementDef, RANK_COINS } from './achievements.definitions';
import { NotificationsService } from '../notifications/notifications.service';

const RANK_COLOR: Record<1 | 2 | 3 | 4, string> = {
  1: '#9ca3af',
  2: '#3b82f6',
  3: '#a855f7',
  4: '#f59e0b',
};
export type { AchievementDef };

// ── Trigger types ─────────────────────────────────────────────
export type AchievementTrigger =
  | { type: 'task_created'; taskRepeat: string; taskType: string; hasEndDate: boolean }
  | { type: 'task_completed'; taskTime: string | null; taskType: string }
  | { type: 'tag_created' }
  | { type: 'profile_updated'; displayName: string | null; avatarUrl: string | null; bio: string | null };

export interface AchievementResult extends AchievementDef {
  unlocked: boolean;
  unlockedAt?: string;
}

// ── Service ───────────────────────────────────────────────────
@Injectable()
export class AchievementsService {
  constructor(
    @InjectRepository(UserAchievement)
    private readonly achRepo: Repository<UserAchievement>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(TaskCompletion)
    private readonly completionRepo: Repository<TaskCompletion>,
    @InjectRepository(Tag)
    private readonly tagRepo: Repository<Tag>,
    private readonly notifications: NotificationsService,
  ) {}

  // ── Публичный список достижений пользователя ──────────────
  async getAll(userId: string): Promise<AchievementResult[]> {
    const rows = await this.achRepo.find({ where: { userId } });
    const unlockedMap = new Map(rows.map(r => [r.defId, r.unlockedAt]));

    return ACHIEVEMENTS.map(def => ({
      ...def,
      unlocked: unlockedMap.has(def.id),
      unlockedAt: unlockedMap.get(def.id)?.toISOString(),
    }));
  }

  // ── Проверить и выдать новые достижения ───────────────────
  async checkAndUnlock(userId: string, trigger: AchievementTrigger): Promise<AchievementDef[]> {
    const existing = await this.achRepo.find({ where: { userId } });
    const unlockedIds = new Set(existing.map(e => e.defId));

    const candidates = ACHIEVEMENTS.filter(a => !unlockedIds.has(a.id));
    const newlyUnlocked: AchievementDef[] = [];

    for (const def of candidates) {
      const should = await this.shouldUnlock(userId, def.id, trigger);
      if (should) {
        await this.achRepo.save(this.achRepo.create({ userId, defId: def.id }));
        await this.userRepo.increment({ id: userId }, 'xp', def.xp);
        await this.userRepo.increment({ id: userId }, 'coins', RANK_COINS[def.rank]);
        await this.notifications.create({
          userId,
          kind:  'achievement',
          title: `Достижение: ${def.title}`,
          body:  `${def.description} · +${def.xp} XP · +${RANK_COINS[def.rank]} монет`,
          icon:  def.icon,
          color: RANK_COLOR[def.rank],
        });
        newlyUnlocked.push(def);
        unlockedIds.add(def.id);
      }
    }

    return newlyUnlocked;
  }

  // ── Логика условий ────────────────────────────────────────
  private async shouldUnlock(
    userId: string,
    defId: string,
    trigger: AchievementTrigger,
  ): Promise<boolean> {
    switch (defId) {

      // ── Первые шаги ──────────────────────────────────────
      case 'first_task':
        return trigger.type === 'task_created';

      case 'first_done':
        return trigger.type === 'task_completed';

      case 'first_repeat':
        return trigger.type === 'task_created' && trigger.taskRepeat !== 'none';

      case 'first_mandatory':
        return trigger.type === 'task_created' && trigger.taskType === 'mandatory';

      case 'first_multiday':
        return trigger.type === 'task_created' && trigger.hasEndDate;

      case 'first_tag':
        return trigger.type === 'tag_created';

      case 'profile_filled': {
        if (trigger.type !== 'profile_updated') return false;
        const { displayName, avatarUrl, bio } = trigger;
        return !!(displayName?.trim() && avatarUrl && bio?.trim());
      }

      // ── Количество выполненных задач ─────────────────────
      case 'tasks_10':
      case 'tasks_50':
      case 'tasks_100':
      case 'tasks_500':
      case 'tasks_1000': {
        if (trigger.type !== 'task_completed') return false;
        const targets: Record<string, number> = {
          tasks_10: 10, tasks_50: 50, tasks_100: 100, tasks_500: 500, tasks_1000: 1000,
        };
        const count = await this.completionRepo.count({ where: { userId } });
        return count >= targets[defId];
      }

      // ── Обязательные задачи ──────────────────────────────
      case 'mandatory_10':
      case 'mandatory_50': {
        if (trigger.type !== 'task_completed' || trigger.taskType !== 'mandatory') return false;
        const target = defId === 'mandatory_10' ? 10 : 50;
        const mandatoryIds = await this.taskRepo
          .find({ where: { userId, type: 'mandatory' }, select: ['id'] })
          .then(ts => ts.map(t => t.id));
        if (!mandatoryIds.length) return false;
        const count = await this.completionRepo.count({
          where: { userId, taskId: In(mandatoryIds) },
        });
        return count >= target;
      }

      // ── Время задачи ─────────────────────────────────────
      case 'morning_bird':
        return (
          trigger.type === 'task_completed' &&
          !!trigger.taskTime &&
          trigger.taskTime < '08:00'
        );

      case 'night_owl':
        return (
          trigger.type === 'task_completed' &&
          !!trigger.taskTime &&
          trigger.taskTime >= '22:00'
        );

      // ── Серии (стрики) ────────────────────────────────────
      case 'streak_3':
      case 'streak_7':
      case 'streak_30':
      case 'streak_100':
      case 'streak_365': {
        if (trigger.type !== 'task_completed') return false;
        const targets: Record<string, number> = {
          streak_3: 3, streak_7: 7, streak_30: 30, streak_100: 100, streak_365: 365,
        };
        const streak = await this.getCurrentStreak(userId);
        return streak >= targets[defId];
      }

      // ── Теги ─────────────────────────────────────────────
      case 'tags_5': {
        if (trigger.type !== 'tag_created') return false;
        const count = await this.tagRepo.count({ where: { userId } });
        return count >= 5;
      }

      default:
        return false;
    }
  }

  // ── Вычислить текущую серию дней ──────────────────────────
  private async getCurrentStreak(userId: string): Promise<number> {
    const rows = await this.completionRepo
      .createQueryBuilder('c')
      .select('DISTINCT c.date', 'date')
      .where('c.userId = :userId', { userId })
      .orderBy('date', 'DESC')
      .getRawMany<{ date: string }>();

    if (!rows.length) return 0;

    const todayStr  = this.dateStr(new Date());
    const yesterdayStr = this.dateStr(new Date(Date.now() - 86_400_000));

    // Серия должна включать сегодня или вчера
    if (rows[0].date !== todayStr && rows[0].date !== yesterdayStr) return 0;

    let streak = 1;
    for (let i = 1; i < rows.length; i++) {
      const prev = new Date(rows[i - 1].date + 'T00:00:00');
      prev.setDate(prev.getDate() - 1);
      if (rows[i].date === this.dateStr(prev)) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  private dateStr(d: Date): string {
    return d.toISOString().split('T')[0];
  }
}
