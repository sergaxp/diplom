import {
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  ValidateNested,
  Matches,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SyncInstanceDto {
  @IsString()
  ruleId: string;

  /** YYYY-MM-DD вхождения или '-' для custom */
  @IsString()
  @MaxLength(10)
  occurrenceDate: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  linkDate: string;

  /** Абсолютный момент (ISO, UTC) */
  @IsISO8601()
  fireAt: string;

  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  occTime?: string | null;
}

export class SyncRemindersDto {
  @IsString()
  taskId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncInstanceDto)
  instances: SyncInstanceDto[];
}

export class SnoozeReminderDto {
  @IsString()
  token: string;

  @IsOptional()
  minutes?: number;
}

export class CompleteReminderDto {
  @IsString()
  token: string;
}
