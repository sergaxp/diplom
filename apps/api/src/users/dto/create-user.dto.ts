import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class CreateUserDto {
  @IsString({ message: 'Логин должен быть строкой' })
  @MinLength(3, { message: 'Логин должен быть минимум 3 символа' })
  @MaxLength(32, { message: 'Логин не может быть длиннее 32 символов' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Логин может содержать только буквы, цифры, _ и -',
  })
  username: string;

  @IsEmail({}, { message: 'Введите корректный email' })
  @MaxLength(255, { message: 'Email слишком длинный' })
  email: string;

  @IsString({ message: 'Пароль должен быть строкой' })
  @MinLength(8, { message: 'Пароль должен быть минимум 8 символов' })
  @MaxLength(72, { message: 'Пароль не может быть длиннее 72 символов' })
  password: string;
}
