import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  // Можно войти через username или email
  @IsString({ message: 'Введите логин или email' })
  identifier: string;

  @IsString({ message: 'Введите пароль' })
  @MinLength(8, { message: 'Пароль должен быть минимум 8 символов' })
  password: string;
}
