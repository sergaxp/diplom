import { IsEmail, IsString, MaxLength } from 'class-validator';

export class ChangeEmailDto {
  @IsEmail({}, { message: 'Введите корректный email' })
  @MaxLength(255, { message: 'Email слишком длинный' })
  newEmail: string;

  @IsString({ message: 'Введите пароль для подтверждения' })
  password: string;
}
