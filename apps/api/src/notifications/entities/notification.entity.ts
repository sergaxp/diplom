import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type NotificationKind =
  | 'achievement'
  | 'task_completed'
  | 'daily_bonus'
  | 'purchase'
  | 'reminder';

@Entity('notifications')
@Index(['userId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  userId: string;

  @Column({ type: 'varchar', length: 32 })
  kind: NotificationKind;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  body: string | null;

  /** Lucide-icon name, e.g. 'Trophy', 'CheckCircle' */
  @Column({ type: 'varchar', length: 64, nullable: true })
  icon: string | null;

  /** Hex color for accent (e.g. rank colour for achievements) */
  @Column({ type: 'varchar', length: 16, nullable: true })
  color: string | null;

  @Column({ type: 'boolean', default: false })
  read: boolean;

  // timestamptz: иначе naive-время трактуется клиентом как локальное и «уезжает»
  // на величину часового пояса пользователя (баг «N часов назад» сразу после создания).
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
