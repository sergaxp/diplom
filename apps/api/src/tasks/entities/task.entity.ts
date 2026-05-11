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

  @Column({ type: 'varchar', length: 10, default: 'none' })
  repeat: string;

  @Column({ type: 'varchar', length: 10, nullable: true, default: null })
  repeatUntil: string | null;

  @Column({ type: 'varchar', length: 20, default: 'normal' })
  type: string;

  @Column({ type: 'varchar', length: 64, nullable: true, default: null })
  icon: string | null;

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
