import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToMany } from 'typeorm';
import { Task } from '../../tasks/entities/task.entity';

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  userId: string;

  @Column({ type: 'varchar', length: 64 })
  name: string;

  @Column({ type: 'varchar', length: 64, nullable: true, default: null })
  icon: string | null;

  @Column({ type: 'varchar', length: 20, default: '#6b7280' })
  color: string;

  @ManyToMany(() => Task, t => t.tags)
  tasks: Task[];

  @CreateDateColumn()
  createdAt: Date;
}
