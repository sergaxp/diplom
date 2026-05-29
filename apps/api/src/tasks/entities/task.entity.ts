import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, ManyToMany, JoinTable, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Tag } from '../../tags/entities/tag.entity';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true, default: null })
  description: string | null;

  @Column({ type: 'varchar', length: 10 })
  date: string; // YYYY-MM-DD

  @Column({ type: 'varchar', length: 5, nullable: true, default: null })
  time: string | null; // HH:MM

  @Column({ type: 'varchar', length: 5, nullable: true, default: null })
  endTime!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true, default: null })
  endDate!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'none' })
  repeat: string;

  @Column({ type: 'json', nullable: true, default: null })
  repeatConfig: object | null;

  @Column({ type: 'varchar', length: 10, nullable: true, default: null })
  repeatUntil: string | null;

  @Column({ type: 'varchar', length: 20, default: 'normal' })
  type: string;

  @Column({ type: 'varchar', length: 20, default: 'none' })
  priority: string;

  @Column({ type: 'varchar', length: 64, nullable: true, default: null })
  icon: string | null;

  @Column({ type: 'json', nullable: true, default: null })
  subtasks: object[] | null;

  /**
   * Переопределения по конкретным дням многодневной/повторяющейся задачи:
   * { "YYYY-MM-DD": { title?, description?, time?, endTime?, priority?, icon?,
   *   subtasks?, deleted? } }. Позволяет редактировать/удалять отдельный день
   * и хранить подзадачи конкретного дня, не разбивая задачу на строки.
   */
  @Column({ type: 'json', nullable: true, default: null })
  dayOverrides: Record<string, object> | null;

  @ManyToMany(() => Tag, tag => tag.tasks, { eager: false, cascade: false })
  @JoinTable({
    name: 'task_tags',
    joinColumn:        { name: 'taskId',  referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tagId',   referencedColumnName: 'id' },
  })
  tags!: Tag[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
