import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export interface HolidayEntry {
  date: string; // YYYY-MM-DD
  name: string;
  /** holiday=нерабочий, shortday=предпраздничный, workday=перенесённый рабочий */
  type: 'holiday' | 'shortday' | 'workday';
}

@Entity('holiday_cache')
export class HolidayCache {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  year: number;

  @Column({ type: 'json' })
  entries: HolidayEntry[];

  @CreateDateColumn()
  fetchedAt: Date;
}
