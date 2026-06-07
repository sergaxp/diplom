import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * Audit запись о факте удаления аккаунта.
 * Не хранит ничего идентифицирующего, чтобы соблюсти "удаление без восстановления" –
 * только timestamp для публичной статистики.
 */
@Entity('account_deletion')
export class AccountDeletion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  deletedAt: Date;

  @Column({ type: 'varchar', length: 32, nullable: true })
  usernameHint: string | null;
}
