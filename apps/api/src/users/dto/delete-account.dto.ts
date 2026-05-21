import { IsString } from 'class-validator';

export class DeleteAccountDto {
  @IsString({ message: 'Введите пароль для подтверждения удаления' })
  password: string;
}
