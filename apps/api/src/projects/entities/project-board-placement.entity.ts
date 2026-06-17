import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Позиция карточки на доске ПРОЕКТА (в отличие от board_placements, которая
 * ключуется по дню). Карточка проекта = задача один раз, поэтому ключ —
 * (projectId, cardKey) без даты. Хранит позиции в неконечных колонках
 * (todo = отсутствие строки, doing/custom = строка). «Завершённые» здесь НЕ
 * хранится: done задачи = Task.completedAt (для прогресса/архива).
 *
 * cardKey: 'task:<taskId>'
 */
@Entity('project_board_placements')
@Unique('UQ_project_board_placement', ['projectId', 'cardKey'])
export class ProjectBoardPlacement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar' })
  projectId: string;

  @Column({ type: 'varchar', length: 255 })
  cardKey: string;

  @Column({ type: 'varchar', length: 64 })
  columnId: string;

  /** Позиция карточки внутри колонки (дробная — для вставки между соседями). */
  @Column({ type: 'double precision', default: 0 })
  position: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
