import { IsString, IsOptional, IsIn, Matches, MaxLength } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

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
  @IsIn(['none', 'daily', 'weekdays', 'weekly', 'monthly', 'yearly', 'custom'])
  repeat?: string;

  @IsOptional()
  repeatConfig?: object | null;

  @IsOptional()
  @IsString()
  repeatUntil?: string | null;

  @IsOptional()
  @IsIn(['normal', 'mandatory', 'event'])
  type?: string;

  @IsOptional()
  @IsIn(['none', 'low', 'medium', 'high'])
  priority?: string;

  @IsOptional()
  @IsString({ each: true })
  tagIds?: string[];

  @IsOptional()
  @IsString()
  icon?: string | null;

  @IsOptional()
  subtasks?: object[] | null;
}
