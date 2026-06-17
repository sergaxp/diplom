import { BoardColumn } from '../board/board.types';

export type { BoardColumn };
export {
  DEFAULT_BOARD_COLUMNS as DEFAULT_PROJECT_COLUMNS,
  MAX_BOARD_COLUMNS as MAX_PROJECT_COLUMNS,
} from '../board/board.types';

/** Этап (веха) проекта — группировка задач выше колонок доски. */
export interface ProjectMilestone {
  id: string;
  name: string;
  position: number;
}

/** Через сколько РАБОЧИХ дней выполненная карточка уходит в авто-архив. */
export const ARCHIVE_AFTER_WORKDAYS = 3;
