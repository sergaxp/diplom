import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { BoardColumn, ProjectMilestone } from '../project.types';

/**
 * Проект — контейнер задач со своей (не «по дню») доской. Колонки доски лежат
 * прямо здесь (boardColumns, как у User.boardColumns), позиции карточек —
 * в project_board_placements. tagId — один тег из тегов пользователя (без FK:
 * висячий id просто не отрисуется на клиенте).
 */
@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true, default: null })
  description: string | null;

  /** Один тег пользователя (id). */
  @Column({ type: 'varchar', nullable: true, default: null })
  tagId: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, default: null })
  color: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, default: null })
  icon: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true, default: null })
  deadline: string | null; // YYYY-MM-DD

  @Column({ type: 'boolean', default: false })
  archived: boolean;

  /** Раскладка колонок доски проекта (если null — берутся дефолтные). */
  @Column({ type: 'json', nullable: true, default: null })
  boardColumns: BoardColumn[] | null;

  /** Этапы (вехи) проекта. */
  @Column({ type: 'json', nullable: true, default: null })
  milestones: ProjectMilestone[] | null;

  /** Порядок проекта в списке. */
  @Column({ type: 'int', default: 0 })
  position: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
