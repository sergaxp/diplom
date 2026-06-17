import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Task } from '../../tasks/entities/task.entity';

export type CollabStatus = 'pending' | 'accepted' | 'declined';

/**
 * Участник совместной задачи. Создатель задачи приглашает по @username — строка
 * заводится со status='pending'; после ответа становится accepted/declined.
 * accepted-участники видят задачу в своём календаре и могут её редактировать
 * (но не удалять — это право только владельца task.userId).
 */
@Entity('task_collaborators')
@Unique('UQ_task_collaborator', ['taskId', 'userId'])
@Index(['userId', 'status'])
export class TaskCollaborator {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar' })
  taskId: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'taskId' })
  task: Task;

  /** Приглашённый пользователь. */
  @Column({ type: 'varchar' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  /** Кто пригласил (владелец задачи). */
  @Column({ type: 'varchar' })
  invitedById: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: CollabStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  respondedAt: Date | null;
}
