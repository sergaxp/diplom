import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Task } from '../../tasks/entities/task.entity';
import { Project } from '../../projects/entities/project.entity';

/**
 * Комментарий-чат под совместной задачей ИЛИ проектом. Ровно одно из taskId/projectId
 * задано. Оставить может любой accepted-участник или владелец; удалить — автор или
 * владелец сущности. Каскадно удаляется вместе с задачей/проектом.
 */
@Entity('collab_comments')
@Index(['taskId', 'createdAt'])
@Index(['projectId', 'createdAt'])
export class CollabComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true, default: null })
  taskId: string | null;

  @ManyToOne(() => Task, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'taskId' })
  task: Task | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  projectId: string | null;

  @ManyToOne(() => Project, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'projectId' })
  project: Project | null;

  @Column({ type: 'varchar' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column({ type: 'varchar', length: 2000 })
  text: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
