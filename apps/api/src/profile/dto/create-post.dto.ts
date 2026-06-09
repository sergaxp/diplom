import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreatePostDto {
  @IsString()
  @IsNotEmpty({ message: 'Текст поста не может быть пустым' })
  @MaxLength(2000)
  text: string;
}
