import {
  IsArray,
  IsString,
  IsIn,
  IsOptional,
  MaxLength,
  ArrayMaxSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { BoardColumnRole } from '../../board/board.types';
import { MAX_PROJECT_COLUMNS } from '../project.types';

class ProjectColumnDto {
  @IsString()
  @MaxLength(64)
  id: string;

  @IsString()
  @MaxLength(40)
  name: string;

  @IsIn(['todo', 'doing', 'done', 'custom'])
  role: BoardColumnRole;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;
}

export class UpdateProjectColumnsDto {
  @IsArray()
  @ArrayMaxSize(MAX_PROJECT_COLUMNS)
  @ValidateNested({ each: true })
  @Type(() => ProjectColumnDto)
  columns: ProjectColumnDto[];
}
