import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/** Пост на стене профиля (kitsu-style). Автор == владелец профиля. */
@Entity('posts')
@Index(['authorId', 'createdAt'])
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @Column({ type: 'varchar', length: 2000 })
  text: string;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  imageUrl: string | null;

  /** Ключ объекта в MinIO — нужен для удаления картинки вместе с постом */
  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  imageKey: string | null;

  /** Закреплён — попадает в витрину «Избранные посты» */
  @Column({ type: 'boolean', default: false })
  pinned: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
