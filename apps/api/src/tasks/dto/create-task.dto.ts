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
  @IsIn(['none', 'daily', 'weekly', 'monthly', 'yearly'])
  repeat?: string;

  @IsOptional()
  @IsString()
  repeatUntil?: string | null;

  @IsOptional()
  @IsIn(['normal', 'mandatory', 'event'])
  type?: string;
}
