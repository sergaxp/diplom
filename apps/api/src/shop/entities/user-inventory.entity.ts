import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';

@Entity('user_inventory')
@Unique(['userId', 'itemId'])
export class UserInventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  userId: string;

  @Column({ type: 'varchar', length: 64 })
  itemId: string;

  @CreateDateColumn()
  purchasedAt: Date;
}
