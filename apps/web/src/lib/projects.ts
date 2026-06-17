import { api } from './api';
import { BoardColumn, DEFAULT_COLUMNS } from './board';

export type { BoardColumn };

export interface ProjectMilestone {
  id: string;
  name: string;
  position: number;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  /** Один тег пользователя (id). */
  tagId?: string | null;
  color?: string | null;
  icon?: string | null;
  deadline?: string | null; // YYYY-MM-DD
  archived: boolean;
  boardColumns?: BoardColumn[] | null;
  milestones?: ProjectMilestone[] | null;
  position: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Позиция карточки на доске проекта (todo/doing/custom; done = Task.completedAt). */
export interface ProjectPlacement {
  cardKey: string;
  columnId: string;
  position: number;
}

export interface ProjectBoardState {
  columns: BoardColumn[];
  placements: ProjectPlacement[];
}

export type CreateProjectInput = Pick<Project, 'name'> &
  Partial<Pick<Project, 'description' | 'tagId' | 'color' | 'icon' | 'deadline' | 'milestones'>>;

export type UpdateProjectInput = Partial<
  Pick<
    Project,
    | 'name'
    | 'description'
    | 'tagId'
    | 'color'
    | 'icon'
    | 'deadline'
    | 'archived'
    | 'position'
    | 'milestones'
  >
>;

/** Что сделать с задачами проекта при удалении. */
export type DeleteProjectMode = 'deleteAll' | 'keepCompleted';

export const projectsApi = {
  getAll: (): Promise<Project[]> =>
    api.get<Project[]>('/projects').then((r) => r.data),

  create: (data: CreateProjectInput): Promise<Project> =>
    api.post<Project>('/projects', data).then((r) => r.data),

  update: (id: string, data: UpdateProjectInput): Promise<Project> =>
    api.patch<Project>(`/projects/${id}`, data).then((r) => r.data),

  remove: (id: string, mode: DeleteProjectMode): Promise<void> =>
    api.delete(`/projects/${id}`, { params: { mode } }).then(() => undefined),

  getBoard: (id: string): Promise<ProjectBoardState> =>
    api.get<ProjectBoardState>(`/projects/${id}/board`).then((r) => r.data),

  setColumns: (id: string, columns: BoardColumn[]): Promise<{ columns: BoardColumn[] }> =>
    api.put<{ columns: BoardColumn[] }>(`/projects/${id}/columns`, { columns }).then((r) => r.data),

  setPlacement: (id: string, p: ProjectPlacement): Promise<void> =>
    api.put(`/projects/${id}/placement`, p).then(() => undefined),

  removePlacement: (id: string, cardKey: string): Promise<void> =>
    api.delete(`/projects/${id}/placement`, { params: { cardKey } }).then(() => undefined),
};

/** Колонки проекта с дефолтом. */
export function projectColumns(project: Project | null | undefined): BoardColumn[] {
  return project?.boardColumns?.length ? project.boardColumns : DEFAULT_COLUMNS;
}

/** Задача проекта считается выполненной, если проставлен completedAt. */
export function isTaskDone(task: { completedAt?: string | null }): boolean {
  return !!task.completedAt;
}

/** Прогресс проекта по списку его задач. */
export function projectProgress(
  tasks: { projectId?: string | null; completedAt?: string | null }[],
  projectId: string,
): { done: number; total: number; pct: number } {
  let done = 0;
  let total = 0;
  for (const t of tasks) {
    if (t.projectId !== projectId) continue;
    total++;
    if (t.completedAt) done++;
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

// ── Авто-архив выполненных карточек ───────────────────────────
/** Через сколько РАБОЧИХ дней выполненная карточка уходит в архив. */
export const ARCHIVE_AFTER_WORKDAYS = 3;

/** Кол-во полных рабочих дней (пн–пт), прошедших от `from` до `to`. */
export function workdaysBetween(from: Date, to: Date): number {
  if (to <= from) return 0;
  let count = 0;
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (d < end) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) count++;
  }
  return count;
}

/** Выполненная карточка, пролежавшая ≥ N рабочих дней, считается архивной. */
export function isAutoArchived(
  completedAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!completedAt) return false;
  const done = new Date(completedAt);
  if (Number.isNaN(done.getTime())) return false;
  return workdaysBetween(done, now) >= ARCHIVE_AFTER_WORKDAYS;
}
