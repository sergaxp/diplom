import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';
import { TaskRepeat } from './task.entity';

@Entity('global_tasks')
export class GlobalTask {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true, default: null })
  description!: string | null;

  @Column({ type: 'varchar', length: 10 })
  date!: string; // YYYY-MM-DD

  @Column({ type: 'varchar', length: 5, nullable: true, default: null })
  time!: string | null;

  @Column({ type: 'varchar', length: 10, default: TaskRepeat.NONE })
  repeat!: TaskRepeat;

  @Column({ type: 'varchar', length: 10, nullable: true, default: null })
  repeatUntil!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, default: null })
  icon!: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  createdBy!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
