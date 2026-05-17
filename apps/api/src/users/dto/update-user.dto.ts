import { IsString, IsOptional, MaxLength, MinLength, Matches, IsNumber, IsBoolean } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Имя пользователя может содержать только буквы, цифры, _ и -',
  })
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @IsOptional()
  @IsNumber()
  locationLat?: number;

  @IsOptional()
  @IsNumber()
  locationLon?: number;

  @IsOptional()
  @IsBoolean()
  showGlobalEvents?: boolean;

  @IsOptional()
  @IsBoolean()
  showHolidays?: boolean;
}
