import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';

@Entity('task_completions')
@Unique(['taskId', 'userId', 'date'])
export class TaskCompletion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  taskId: string;

  @Column({ type: 'varchar' })
  userId: string;

  @Column({ type: 'varchar', length: 10 })
  date: string; // YYYY-MM-DD

  @CreateDateColumn()
  completedAt: Date;
}
