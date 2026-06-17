import { IsString, IsNumber, MaxLength } from 'class-validator';

export class SetProjectPlacementDto {
  @IsString()
  @MaxLength(255)
  cardKey: string;

  @IsString()
  @MaxLength(64)
  columnId: string;

  @IsNumber()
  position: number;
}
