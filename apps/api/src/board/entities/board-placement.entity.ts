import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Позиция карточки на доске в неконечной колонке (Начатые/кастомные).
 * Строка существует только когда карточка вынесена из «Не начатые»:
 * «Не начатые» = отсутствие строки, «Завершённые» = реальное выполнение
 * (хранится в task-completions / done подзадач, здесь не дублируется).
 *
 * cardKey: 'task:<taskId>' | 'sub:<taskId>:<itemId>'
 * date:    дата вхождения карточки (YYYY-MM-DD)
 */
@Entity('board_placements')
@Unique('UQ_board_placement', ['userId', 'cardKey', 'date'])
export class BoardPlacement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar' })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  cardKey: string;

  @Column({ type: 'varchar', length: 10 })
  date: string;

  @Column({ type: 'varchar', length: 64 })
  columnId: string;

  /** Позиция карточки внутри колонки (дробная — для вставки между соседями). */
  @Column({ type: 'double precision', default: 0 })
  position: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
