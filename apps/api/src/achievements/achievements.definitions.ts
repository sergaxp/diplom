export type AchievementRank = 1 | 2 | 3 | 4;

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  rank: AchievementRank;
  xp: number;
  icon: string;
  secret?: boolean;
}

export const RANK_XP: Record<AchievementRank, number> = {
  1: 500,
  2: 1000,
  3: 2000,
  4: 4000,
};

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Первые шаги (Обычные) ─────────────────────────────────
  { id: 'first_task',      title: 'Первый шаг',           description: 'Создать первую задачу',                            rank: 1, xp: 500,  icon: 'Plus' },
  { id: 'first_done',      title: 'Сделано!',              description: 'Выполнить первую задачу',                          rank: 1, xp: 500,  icon: 'CheckCircle' },
  { id: 'first_tag',       title: 'Организатор',           description: 'Создать свой первый тег',                         rank: 1, xp: 500,  icon: 'Tag' },
  { id: 'first_repeat',    title: 'Привычка',              description: 'Создать повторяющуюся задачу',                    rank: 1, xp: 500,  icon: 'RefreshCw' },
  { id: 'first_mandatory', title: 'Без права на ошибку',   description: 'Создать обязательную задачу',                     rank: 1, xp: 500,  icon: 'AlertCircle' },
  { id: 'first_multiday',  title: 'На несколько дней',     description: 'Создать многодневную задачу',                     rank: 1, xp: 500,  icon: 'CalendarRange' },
  { id: 'profile_filled',  title: 'Лицо платформы',        description: 'Заполнить имя, аватар и описание профиля',        rank: 1, xp: 500,  icon: 'UserCheck' },
  // ── Рост (Обычные) ────────────────────────────────────────
  { id: 'tasks_10',        title: 'Первая дюжина',         description: 'Выполнить 10 задач',                              rank: 1, xp: 500,  icon: 'List' },
  { id: 'tasks_50',        title: 'В ритме',               description: 'Выполнить 50 задач',                              rank: 1, xp: 500,  icon: 'Zap' },
  { id: 'morning_bird',    title: 'Ранняя пташка',         description: 'Выполнить задачу, запланированную до 08:00',      rank: 1, xp: 500,  icon: 'Sunrise' },
  { id: 'night_owl',       title: 'Совёнок',               description: 'Выполнить задачу, запланированную после 22:00',   rank: 1, xp: 500,  icon: 'Moon' },
  { id: 'streak_3',        title: 'Три дня подряд',        description: 'Выполнять задачи 3 дня подряд',                  rank: 1, xp: 500,  icon: 'Flame' },
  // ── Настойчивость (Редкие) ────────────────────────────────
  { id: 'tasks_100',       title: 'Сотня',                 description: 'Выполнить 100 задач',                             rank: 2, xp: 1000, icon: 'Award' },
  { id: 'streak_7',        title: 'Неделя без остановки',  description: 'Выполнять задачи 7 дней подряд',                 rank: 2, xp: 1000, icon: 'Flame' },
  { id: 'mandatory_10',    title: 'Железная воля',         description: 'Выполнить 10 обязательных задач',                rank: 2, xp: 1000, icon: 'Shield' },
  { id: 'tags_5',          title: 'Система',               description: 'Создать 5 тегов',                                rank: 2, xp: 1000, icon: 'Tags' },
  // ── Мастерство (Эпические) ────────────────────────────────
  { id: 'tasks_500',       title: 'Полпути к тысяче',      description: 'Выполнить 500 задач',                             rank: 3, xp: 2000, icon: 'Trophy' },
  { id: 'streak_30',       title: 'Месяц без перерыва',    description: 'Выполнять задачи 30 дней подряд',                rank: 3, xp: 2000, icon: 'Flame' },
  { id: 'mandatory_50',    title: 'Несгибаемый',           description: 'Выполнить 50 обязательных задач',                rank: 3, xp: 2000, icon: 'ShieldCheck' },
  // ── Легенда (Легендарные) ─────────────────────────────────
  { id: 'tasks_1000',      title: 'Тысячник',              description: 'Выполнить 1000 задач',                            rank: 4, xp: 4000, icon: 'Star' },
  { id: 'streak_100',      title: 'Сто дней',              description: 'Выполнять задачи 100 дней подряд',               rank: 4, xp: 4000, icon: 'Flame', secret: true },
  { id: 'streak_365',      title: 'Год в строю',           description: 'Выполнять задачи 365 дней подряд',               rank: 4, xp: 4000, icon: 'Crown', secret: true },
];

export const ACHIEVEMENT_MAP = new Map<string, AchievementDef>(
  ACHIEVEMENTS.map(a => [a.id, a]),
);
