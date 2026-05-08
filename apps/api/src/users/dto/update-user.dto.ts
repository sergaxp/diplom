import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  bio?: string;
}
