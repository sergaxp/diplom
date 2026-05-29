import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class GoogleCompleteDto {
  @IsString()
  signupToken: string;

  @IsString({ message: 'Логин должен быть строкой' })
  @MinLength(3, { message: 'Логин должен быть минимум 3 символа' })
  @MaxLength(32, { message: 'Логин не может быть длиннее 32 символов' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Логин может содержать только буквы, цифры, _ и -',
  })
  username: string;
}
