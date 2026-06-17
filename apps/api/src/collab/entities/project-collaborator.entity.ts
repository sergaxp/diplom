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
import { Project } from '../../projects/entities/project.entity';
import type { CollabStatus } from './task-collaborator.entity';

/**
 * Участник совместного проекта. Зеркало TaskCollaborator: accepted-участник видит
 * доску и все задачи проекта и может их редактировать; удалять проект и управлять
 * составом может только создатель (project.userId).
 */
@Entity('project_collaborators')
@Unique('UQ_project_collaborator', ['projectId', 'userId'])
@Index(['userId', 'status'])
export class ProjectCollaborator {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column({ type: 'varchar' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar' })
  invitedById: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: CollabStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true, default: null })
  respondedAt: Date | null;
}
