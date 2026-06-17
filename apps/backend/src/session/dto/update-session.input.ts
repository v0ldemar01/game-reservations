import { Field, ID, InputType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf
} from 'class-validator';

import { SessionStatus } from '../models/session-status.enum';

const MAX_COMMENT_LENGTH = 500;
const MAX_PLAYER_NAME_LENGTH = 100;

@InputType()
export class UpdateSessionInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_COMMENT_LENGTH)
  @MinLength(1, { message: 'comment must not be an empty string' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value
  )
  comment?: string;

  @Field({ nullable: true })
  @IsDate()
  @Type(() => Date)
  @ValidateIf(
    (o: UpdateSessionInput) =>
      o.startTime !== undefined || o.endTime !== undefined
  )
  endTime?: Date;

  @Field(() => ID)
  @IsInt()
  @Type(() => Number)
  id!: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PLAYER_NAME_LENGTH)
  @MinLength(1, { message: 'playerName must not be an empty string' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value
  )
  playerName?: string;

  // Both startTime and endTime must be provided together or not at all.
  // Sending only one would silently create an invalid (start > end) state.
  @Field({ nullable: true })
  @IsDate()
  @Type(() => Date)
  @ValidateIf(
    (o: UpdateSessionInput) =>
      o.startTime !== undefined || o.endTime !== undefined
  )
  startTime?: Date;

  @Field(() => SessionStatus, { nullable: true })
  @IsEnum(SessionStatus)
  @IsOptional()
  status?: SessionStatus;
}
