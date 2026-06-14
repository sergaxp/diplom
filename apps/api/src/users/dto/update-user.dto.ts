import {
  IsString,
  IsOptional,
  MaxLength,
  MinLength,
  Matches,
  IsNumber,
  IsBoolean,
  IsObject,
  IsArray,
} from 'class-validator';
import { ShowcaseBlock } from '../../profile/showcase.types';

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

  /** Время напоминаний для задач без времени (HH:MM) */
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  reminderDefaultTime?: string;

  /** ID экипированной рамки из магазина, или null для снятия */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  selectedFrame?: string | null;

  /** ID экипированного фона профиля из магазина, или null для снятия */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  selectedBackground?: string | null;

  /** Ссылки на соцсети: { provider: url }. Передайте {} чтобы стереть все. */
  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string> | null;

  /** Конфиг витрин профиля (упорядоченный массив блоков). [] — стереть все. */
  @IsOptional()
  @IsArray()
  showcases?: ShowcaseBlock[] | null;
}
