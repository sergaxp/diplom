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
import { Post } from './post.entity';

/**
 * Комментарий. Покрывает два случая:
 *  - стена профиля (Steam-style): postId = null;
 *  - комментарий под постом: postId задан.
 * Оставить может любой авторизованный пользователь.
 */
@Entity('comments')
@Index(['profileUserId', 'createdAt'])
@Index(['postId', 'createdAt'])
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Кто оставил комментарий */
  @Column({ type: 'varchar' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'authorId' })
  author: User;

  /** На чьём профиле висит комментарий (для стены и каскадного удаления) */
  @Column({ type: 'varchar' })
  profileUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'profileUserId' })
  profileUser: User;

  /** null = комментарий на стене профиля; иначе — под конкретным постом */
  @Column({ type: 'varchar', nullable: true, default: null })
  postId: string | null;

  @ManyToOne(() => Post, { onDelete: 'CASCADE', eager: false, nullable: true })
  @JoinColumn({ name: 'postId' })
  post: Post | null;

  @Column({ type: 'varchar', length: 1000 })
  text: string;

  @CreateDateColumn()
  createdAt: Date;
}
