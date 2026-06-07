import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type BugReportStatus = 'unread' | 'in_progress' | 'fixed';

@Entity('bug_reports')
export class BugReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true, default: null })
  description: string | null;

  @Column({ type: 'json', nullable: true, default: null })
  attachmentUrls: string[] | null;

  @Column({ type: 'json', nullable: true, default: null })
  attachmentKeys: string[] | null;

  @Column({ type: 'varchar', length: 50, default: 'unread' })
  status: BugReportStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
