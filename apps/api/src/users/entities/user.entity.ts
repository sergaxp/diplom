import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ShowcaseBlock } from '../../profile/showcase.types';
import { BoardColumn } from '../../board/board.types';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true, length: 32 })
  username: string;

  @Column({ type: 'varchar', unique: true, length: 255 })
  email: string;

  // nullable: у пользователей, вошедших через Google, пароля нет
  @Column({ type: 'varchar', select: false, nullable: true, default: null })
  password: string | null;

  // Google OAuth: id аккаунта Google (sub). null — обычная регистрация
  @Column({ type: 'varchar', nullable: true, default: null })
  googleId: string | null;

  // Для всех nullable полей – явно указываем type: 'varchar'
  // иначе TypeORM видит тип как "Object" из-за string | null
  @Column({ type: 'varchar', nullable: true, length: 255, default: null })
  displayName: string | null;

  @Column({ type: 'varchar', nullable: true, length: 500, default: null })
  avatarUrl: string | null;

  @Column({ type: 'varchar', nullable: true, length: 500, default: null })
  coverUrl: string | null;

  /** Полностраничный фон профиля (Steam-style подложка). null = без фона */
  @Column({ type: 'varchar', nullable: true, length: 500, default: null })
  backgroundUrl: string | null;

  @Column({ type: 'varchar', nullable: true, length: 200, default: null })
  bio: string | null;

  @Column({ type: 'varchar', nullable: true, length: 100, default: null })
  location: string | null;

  @Column({ type: 'float', nullable: true, default: null })
  locationLat: number | null;

  @Column({ type: 'float', nullable: true, default: null })
  locationLon: number | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ type: 'boolean', default: false })
  isEmailVerified: boolean;

  @Column({ type: 'varchar', nullable: true, default: null })
  emailVerificationToken: string | null;

  @Column({ type: 'varchar', nullable: true, default: null })
  passwordResetToken: string | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  passwordResetExpires: Date | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  lastSeenAt: Date | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: true })
  showGlobalEvents: boolean;

  @Column({ type: 'boolean', default: true })
  showHolidays: boolean;

  /** Время срабатывания напоминаний у задач без `time` (HH:MM) */
  @Column({ type: 'varchar', length: 5, default: '09:00' })
  reminderDefaultTime: string;

  @Column({ type: 'integer', default: 0 })
  xp: number;

  @Column({ type: 'integer', default: 0 })
  coins: number;

  /** Когда в последний раз начислили ежедневный бонус за вход */
  @Column({ type: 'timestamp', nullable: true, default: null })
  lastDailyBonusAt: Date | null;

  /** ID экипированной декорации аватара (напр. 'frame_phoenix'); null = без рамки */
  @Column({ type: 'varchar', length: 64, nullable: true, default: null })
  selectedFrame: string | null;

  /** ID экипированного фона профиля из магазина (напр. 'bg_aurora');
   *  null = используется загруженный backgroundUrl (или ничего) */
  @Column({ type: 'varchar', length: 64, nullable: true, default: null })
  selectedBackground: string | null;

  /** Карта { provider -> url } внешних ссылок профиля (vk, telegram, github и т.д.) */
  @Column({ type: 'json', nullable: true, default: null })
  socialLinks: Record<string, string> | null;

  /** Упорядоченный список блоков-витрин профиля (Steam-style showcases). */
  @Column({ type: 'json', nullable: true, default: null })
  showcases: ShowcaseBlock[] | null;

  /** Раскладка колонок доски (Kanban). null = базовые колонки. */
  @Column({ type: 'json', nullable: true, default: null })
  boardColumns: BoardColumn[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
