import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';
import type { ActivityType } from '../activity.types';

/**
 * Журнал действий пользователя — источник данных для heatmap активности и
 * ленты изменений. Пишется best-effort из tasks/projects сервисов (ошибка
 * логирования не должна ломать основную операцию). Денормализован: храним
 * человекочитаемый `summary` сразу, чтобы лента не зависела от живости задачи
 * (задачу удалили — запись «Задача удалена» всё равно остаётся).
 */
@Entity('activity_events')
@Index('IDX_activity_user_created', ['userId', 'createdAt'])
@Index('IDX_activity_project_created', ['projectId', 'createdAt'])
export class ActivityEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  userId: string;

  /** Проект, к которому относится событие (null = задача вне проекта). */
  @Column({ type: 'varchar', nullable: true, default: null })
  projectId: string | null;

  /** Связанная задача (может быть уже удалена — FK нет специально). */
  @Column({ type: 'varchar', nullable: true, default: null })
  taskId: string | null;

  @Column({ type: 'varchar', length: 32 })
  type: ActivityType;

  /** Готовый текст для ленты, напр. «Завершена задача «Купить чай»». */
  @Column({ type: 'varchar', length: 500 })
  summary: string;

  /** Доп. детали события (напр. { columnId, columnTitle } для перемещения). */
  @Column({ type: 'json', nullable: true, default: null })
  meta: Record<string, string> | null;

  @CreateDateColumn()
  createdAt: Date;
}
