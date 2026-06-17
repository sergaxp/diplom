import { IsString, IsBoolean, MaxLength, MinLength } from 'class-validator';

export class InviteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  username: string;
}

export class RespondDto {
  @IsBoolean()
  accept: boolean;
}

export class CreateCollabCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  text: string;
}
