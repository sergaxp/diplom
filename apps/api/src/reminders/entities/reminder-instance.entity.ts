import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
  Index,
} from 'typeorm';

/**
 * Материализованный момент срабатывания напоминания (абсолютное время `fireAt`).
 * Считается на клиенте по движку повторов и синхронизируется сюда; cron раз в
 * минуту находит «пора» и шлёт push.
 */
@Entity('reminder_instances')
@Unique(['taskId', 'ruleId', 'occurrenceDate'])
@Index(['fired', 'fireAt'])
export class ReminderInstance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  userId: string;

  @Column({ type: 'varchar' })
  taskId: string;

  /** ReminderRule.id (для snooze-копий — с префиксом `snooze:`) */
  @Column({ type: 'varchar' })
  ruleId: string;

  /** YYYY-MM-DD конкретного вхождения; '-' для custom (абсолютных) */
  @Column({ type: 'varchar', length: 10 })
  occurrenceDate: string;

  /** YYYY-MM-DD для deep-link клика по уведомлению */
  @Column({ type: 'varchar', length: 10 })
  linkDate: string;

  /** Абсолютный момент срабатывания */
  @Column({ type: 'timestamptz' })
  fireAt: Date;

  /** Снимок названия задачи на момент синхронизации */
  @Column({ type: 'varchar', length: 255 })
  title: string;

  /** HH:MM времени вхождения (для текста уведомления); null у задач без времени */
  @Column({ type: 'varchar', length: 5, nullable: true })
  occTime: string | null;

  @Column({ type: 'boolean', default: false })
  fired: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
