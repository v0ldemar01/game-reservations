import { Field, ID, InputType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength
} from 'class-validator';

const MAX_COMMENT_LENGTH = 500;
const MAX_PLAYER_NAME_LENGTH = 100;

import { SessionStatus } from '../models/session-status.enum';

@InputType()
export class CreateSessionInput {
  @Field(() => ID)
  @IsInt()
  @Type(() => Number)
  arenaId!: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_COMMENT_LENGTH)
  @MinLength(1, { message: 'comment must not be an empty string' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value
  )
  comment?: string;

  @Field()
  @IsDate()
  @Type(() => Date)
  endTime!: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PLAYER_NAME_LENGTH)
  @MinLength(1, { message: 'playerName must not be an empty string' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value
  )
  playerName?: string;

  @Field()
  @IsDate()
  @Type(() => Date)
  startTime!: Date;

  @Field(() => SessionStatus, { nullable: true })
  @IsEnum(SessionStatus)
  @IsOptional()
  status?: SessionStatus;
}
