import { IsString, IsNumber, MaxLength, Matches } from 'class-validator';

export class SetPlacementDto {
  @IsString()
  @MaxLength(255)
  cardKey: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @IsString()
  @MaxLength(64)
  columnId: string;

  @IsNumber()
  position: number;
}
