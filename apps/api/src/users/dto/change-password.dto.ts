import { IsString, MinLength, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString({ message: 'Введите текущий пароль' })
  currentPassword: string;

  @IsString({ message: 'Введите новый пароль' })
  @MinLength(8, { message: 'Пароль должен быть минимум 8 символов' })
  @MaxLength(72, { message: 'Пароль не может быть длиннее 72 символов' })
  newPassword: string;
}
