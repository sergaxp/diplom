import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(3, { message: 'Логин должен быть минимум 3 символа' })
  @MaxLength(32, { message: 'Логин не может быть длиннее 32 символов' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Логин может содержать только буквы, цифры, _ и -',
  })
  username: string;

  @IsEmail({}, { message: 'Введите корректный email' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Пароль должен быть минимум 8 символов' })
  @MaxLength(72)
  password: string;
}
