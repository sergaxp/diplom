export type AchievementRank = 1 | 2 | 3 | 4;

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  rank: AchievementRank;
  xp: number;
  icon: string;
  secret?: boolean;
  /**
   * Дерево навыков: id достижений-предков, которые должны быть открыты
   * прежде этого. Пустой массив — корень дерева.
   */
  requires: string[];
}

export const RANK_XP: Record<AchievementRank, number> = {
  1: 500,
  2: 1000,
  3: 2000,
  4: 4000,
};

/** Монеты за разблокировку достижения соответствующего ранга */
export const RANK_COINS: Record<AchievementRank, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
};

export const ACHIEVEMENTS: AchievementDef[] = [
  // ── Корень дерева ─────────────────────────────────────────
  {
    id: 'now_with_us',
    title: 'Теперь ты с нами',
    description: 'Зарегистрироваться на платформе',
    rank: 1,
    xp: 500,
    icon: 'Sparkles',
    requires: [],
  },

  // ── Ветвь A · Создание задач ──────────────────────────────
  {
    id: 'first_task',
    title: 'Первый шаг',
    description: 'Создать первую задачу',
    rank: 1,
    xp: 500,
    icon: 'Plus',
    requires: ['now_with_us'],
  },
  {
    id: 'first_repeat',
    title: 'Привычка',
    description: 'Создать повторяющуюся задачу',
    rank: 1,
    xp: 500,
    icon: 'RefreshCw',
    requires: ['first_task'],
  },
  {
    id: 'repeat_5',
    title: 'Ритуал',
    description: 'Создать 5 повторяющихся задач',
    rank: 2,
    xp: 1000,
    icon: 'Repeat',
    requires: ['first_repeat'],
  },
  {
    id: 'first_mandatory',
    title: 'Без права на ошибку',
    description: 'Создать обязательную задачу',
    rank: 1,
    xp: 500,
    icon: 'AlertCircle',
    requires: ['first_task'],
  },
  {
    id: 'mandatory_10',
    title: 'Железная воля',
    description: 'Выполнить 10 обязательных задач',
    rank: 2,
    xp: 1000,
    icon: 'Shield',
    requires: ['first_mandatory'],
  },
  {
    id: 'mandatory_50',
    title: 'Несгибаемый',
    description: 'Выполнить 50 обязательных задач',
    rank: 3,
    xp: 2000,
    icon: 'ShieldCheck',
    requires: ['mandatory_10'],
  },
  {
    id: 'first_multiday',
    title: 'На несколько дней',
    description: 'Создать многодневную задачу',
    rank: 1,
    xp: 500,
    icon: 'CalendarRange',
    requires: ['first_task'],
  },
  {
    id: 'multiday_5',
    title: 'Марафонец',
    description: 'Выполнить 5 многодневных задач',
    rank: 2,
    xp: 1000,
    icon: 'Footprints',
    requires: ['first_multiday'],
  },

  // ── Ветвь B · Выполнение, серии, время ────────────────────
  {
    id: 'first_done',
    title: 'Сделано!',
    description: 'Выполнить первую задачу',
    rank: 1,
    xp: 500,
    icon: 'CheckCircle',
    requires: ['now_with_us'],
  },
  {
    id: 'tasks_10',
    title: 'Первая дюжина',
    description: 'Выполнить 12 задач',
    rank: 1,
    xp: 500,
    icon: 'List',
    requires: ['first_done'],
  },
  {
    id: 'tasks_50',
    title: 'В ритме',
    description: 'Выполнить 50 задач',
    rank: 1,
    xp: 500,
    icon: 'Zap',
    requires: ['tasks_10'],
  },
  {
    id: 'tasks_100',
    title: 'Сотня',
    description: 'Выполнить 100 задач',
    rank: 2,
    xp: 1000,
    icon: 'Award',
    requires: ['tasks_50'],
  },
  {
    id: 'tasks_500',
    title: 'Полпути к тысяче',
    description: 'Выполнить 500 задач',
    rank: 3,
    xp: 2000,
    icon: 'Trophy',
    requires: ['tasks_100'],
  },
  {
    id: 'tasks_1000',
    title: 'Тысячник',
    description: 'Выполнить 1000 задач',
    rank: 4,
    xp: 4000,
    icon: 'Star',
    requires: ['tasks_500'],
  },
  {
    id: 'streak_3',
    title: 'Три дня подряд',
    description: 'Выполнять задачи 3 дня подряд',
    rank: 1,
    xp: 500,
    icon: 'Flame',
    requires: ['first_done'],
  },
  {
    id: 'streak_7',
    title: 'Неделя без остановки',
    description: 'Выполнять задачи 7 дней подряд',
    rank: 2,
    xp: 1000,
    icon: 'Flame',
    requires: ['streak_3'],
  },
  {
    id: 'streak_30',
    title: 'Месяц без перерыва',
    description: 'Выполнять задачи 30 дней подряд',
    rank: 3,
    xp: 2000,
    icon: 'Flame',
    requires: ['streak_7'],
  },
  {
    id: 'streak_100',
    title: 'Сто дней',
    description: 'Выполнять задачи 100 дней подряд',
    rank: 4,
    xp: 4000,
    icon: 'Flame',
    secret: true,
    requires: ['streak_30'],
  },
  {
    id: 'streak_365',
    title: 'Год в строю',
    description: 'Выполнять задачи 365 дней подряд',
    rank: 4,
    xp: 4000,
    icon: 'Crown',
    secret: true,
    requires: ['streak_100'],
  },
  {
    id: 'morning_bird',
    title: 'Ранняя пташка',
    description: 'Выполнить задачу, запланированную до 08:00',
    rank: 1,
    xp: 500,
    icon: 'Sunrise',
    requires: ['first_done'],
  },
  {
    id: 'night_owl',
    title: 'Совёнок',
    description: 'Выполнить задачу, запланированную после 22:00',
    rank: 1,
    xp: 500,
    icon: 'Moon',
    requires: ['first_done'],
  },

  // ── Ветвь C · Личность и организация ──────────────────────
  {
    id: 'profile_filled',
    title: 'Лицо платформы',
    description: 'Заполнить имя, аватар и описание профиля',
    rank: 1,
    xp: 500,
    icon: 'UserCheck',
    requires: ['now_with_us'],
  },
  {
    id: 'settings_explored',
    title: 'Настройщик',
    description: 'Заглянуть в настройки профиля',
    rank: 1,
    xp: 500,
    icon: 'Settings',
    requires: ['profile_filled'],
  },
  {
    id: 'first_tag',
    title: 'Организатор',
    description: 'Создать свой первый тег',
    rank: 1,
    xp: 500,
    icon: 'Tag',
    requires: ['profile_filled'],
  },
  {
    id: 'tags_5',
    title: 'Система',
    description: 'Создать 5 тегов',
    rank: 2,
    xp: 1000,
    icon: 'Tags',
    requires: ['first_tag'],
  },
  {
    id: 'tags_10',
    title: 'Картотека',
    description: 'Создать 10 тегов',
    rank: 2,
    xp: 1000,
    icon: 'Library',
    requires: ['tags_5'],
  },
];

export const ACHIEVEMENT_MAP = new Map<string, AchievementDef>(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);
