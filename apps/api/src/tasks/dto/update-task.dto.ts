import {
  IsString,
  IsOptional,
  IsEnum,
  Matches,
  MaxLength,
} from 'class-validator';
import { TaskRepeat, TaskType, TaskPriority } from '../entities/task.entity';

// Manual partial – avoids @nestjs/mapped-types dependency
export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  time?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string | null;

  @IsOptional()
  @IsEnum(TaskRepeat)
  repeat?: TaskRepeat;

  @IsOptional()
  repeatConfig?: object | null;

  @IsOptional()
  @IsString()
  repeatUntil?: string | null;

  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsString({ each: true })
  tagIds?: string[];

  @IsOptional()
  @IsString()
  icon?: string | null;

  @IsOptional()
  subtasks?: object[] | null;

  @IsOptional()
  dayOverrides?: Record<string, object> | null;
}
