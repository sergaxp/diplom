import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

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

  @Column({ type: 'integer', default: 0 })
  xp: number;

  @Column({ type: 'integer', default: 0 })
  coins: number;

  /** Когда в последний раз начислили ежедневный бонус за вход */
  @Column({ type: 'timestamp', nullable: true, default: null })
  lastDailyBonusAt: Date | null;

  /** ID экипированной рамки аватара (напр. 'frame_blue'); null = без рамки */
  @Column({ type: 'varchar', length: 64, nullable: true, default: null })
  selectedFrame: string | null;

  /** Карта { provider -> url } внешних ссылок профиля (vk, telegram, github и т.д.) */
  @Column({ type: 'json', nullable: true, default: null })
  socialLinks: Record<string, string> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
