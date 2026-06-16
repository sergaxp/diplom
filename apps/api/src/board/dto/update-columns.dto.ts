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
import type { BoardColumnRole } from '../board.types';
import { MAX_BOARD_COLUMNS } from '../board.types';

class BoardColumnDto {
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

export class UpdateColumnsDto {
  @IsArray()
  @ArrayMaxSize(MAX_BOARD_COLUMNS)
  @ValidateNested({ each: true })
  @Type(() => BoardColumnDto)
  columns: BoardColumnDto[];
}
