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

  @Column({ type: 'varchar', select: false })
  password: string;

  // Для всех nullable полей — явно указываем type: 'varchar'
  // иначе TypeORM видит тип как "Object" из-за string | null
  @Column({ type: 'varchar', nullable: true, length: 255, default: null })
  displayName: string | null;

  @Column({ type: 'varchar', nullable: true, length: 500, default: null })
  avatarUrl: string | null;

  @Column({ type: 'varchar', nullable: true, length: 500, default: null })
  coverUrl: string | null;

  @Column({ type: 'varchar', nullable: true, length: 200, default: null })
  bio: string | null;

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}