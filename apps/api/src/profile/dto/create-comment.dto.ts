import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class CreateCommentDto {
  /** Профиль, на котором оставляют комментарий */
  @IsString()
  @IsNotEmpty()
  profileUsername: string;

  /** id поста; не указан — комментарий на стене профиля */
  @IsOptional()
  @IsString()
  postId?: string;

  @IsString()
  @IsNotEmpty({ message: 'Комментарий не может быть пустым' })
  @MaxLength(1000)
  text: string;
}
