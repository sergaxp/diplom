import { Task } from './tasks';
import { Project } from './projects';

export type MoodLevel = 'good' | 'warn' | 'bad';

export interface ProjectMoodResult {
  level: MoodLevel;
  /** Короткая подпись: «Всё хорошо» / «Есть сложности» / «Завал». */
  label: string;
  /** Пояснение для облачка: «3 просрочены · 2 застряли». */
  reason: string;
  signals: {
    open: number;
    overdue: number;
    stuck: number;
    projectOverdue: boolean;
  };
}

// ── Пороги (вынесены, чтобы легко крутить) ──────────────────────
/** Сколько дней без изменений = задача «застряла». */
export const STUCK_DAYS = 7;
/** Доля «плохих» задач, выше которой — «Завал». */
const BAD_RATIO = 0.4;
/** Сколько просроченных задач сразу тянет в «Завал». */
const BAD_OVERDUE_ABS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

const LABELS: Record<MoodLevel, string> = {
  good: 'Всё хорошо',
  warn: 'Есть сложности',
  bad: 'Завал',
};

function todayStart(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Дедлайн задачи = конец (endDate) либо дата (date). */
function taskDue(t: Task): string | null {
  return t.endDate ?? t.date ?? null;
}

/**
 * Настроение проекта по его задачам. Считается из двух сигналов:
 *  - просроченные дедлайны (open-задача с прошедшей датой);
 *  - застрявшие задачи (open-задача без изменений ≥ STUCK_DAYS дней).
 * Дополнительно: прошедший дедлайн самого проекта при незавершённости.
 */
export function computeProjectMood(
  tasks: Task[],
  project: Pick<Project, 'id' | 'deadline'>,
  now: Date = new Date(),
): ProjectMoodResult {
  const today = todayStart(now);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const projectTasks = tasks.filter((t) => t.projectId === project.id);
  const open = projectTasks.filter((t) => !t.completedAt);

  let overdue = 0;
  let stuck = 0;
  for (const t of open) {
    const due = taskDue(t);
    if (due && due < todayStr) overdue++;

    const last = t.updatedAt ?? t.createdAt;
    if (last) {
      const ageDays = (today.getTime() - todayStart(new Date(last)).getTime()) / DAY_MS;
      if (ageDays >= STUCK_DAYS) stuck++;
    }
  }

  const projectOverdue =
    !!project.deadline &&
    project.deadline < todayStr &&
    open.length > 0;

  const openCount = open.length;
  const badRatio = openCount
    ? (0.6 * overdue + 0.4 * stuck) / openCount
    : 0;

  let level: MoodLevel;
  if (openCount === 0) {
    level = 'good';
  } else if (
    projectOverdue ||
    overdue >= BAD_OVERDUE_ABS ||
    badRatio >= BAD_RATIO
  ) {
    level = 'bad';
  } else if (overdue > 0 || stuck > 0) {
    level = 'warn';
  } else {
    level = 'good';
  }

  return {
    level,
    label: LABELS[level],
    reason: buildReason(level, { open: openCount, overdue, stuck, projectOverdue }),
    signals: { open: openCount, overdue, stuck, projectOverdue },
  };
}

function buildReason(
  level: MoodLevel,
  s: { open: number; overdue: number; stuck: number; projectOverdue: boolean },
): string {
  if (s.open === 0) return 'Нет активных задач';
  const parts: string[] = [];
  if (s.overdue > 0) parts.push(`${s.overdue} ${plural(s.overdue, 'просрочена', 'просрочены', 'просрочено')}`);
  if (s.stuck > 0) parts.push(`${s.stuck} ${plural(s.stuck, 'застряла', 'застряли', 'застряло')}`);
  if (s.projectOverdue) parts.push('дедлайн проекта прошёл');
  if (!parts.length) {
    return level === 'good' ? 'Всё под контролем' : 'Есть над чем поработать';
  }
  return parts.join(' · ');
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}
