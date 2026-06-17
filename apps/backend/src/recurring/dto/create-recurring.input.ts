import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  Max,
  Min,
  MinLength
} from 'class-validator';

const MAX_DAY_OF_WEEK = 6;
const MAX_HOUR = 23;
const MAX_MINUTE = 59;
const MAX_WEEKS_AHEAD = 52;

@InputType()
export class CreateRecurringInput {
  @Field(() => ID)
  @IsNotEmpty()
  arenaId!: string;

  @Field({ nullable: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value
  )
  comment?: string;

  @Field(() => Int, { description: '0=Sun, 1=Mon, … 6=Sat' })
  @IsInt()
  @Max(MAX_DAY_OF_WEEK)
  @Min(0)
  dayOfWeek!: number;

  @Field(() => Int)
  @IsInt()
  @Max(MAX_HOUR)
  @Min(0)
  endHour!: number;

  @Field(() => Int)
  @IsInt()
  @Max(MAX_MINUTE)
  @Min(0)
  endMin!: number;

  @Field({ nullable: true })
  @IsOptional()
  @MinLength(1)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || undefined : value
  )
  playerName?: string;

  @Field(() => Int)
  @IsInt()
  @Max(MAX_HOUR)
  @Min(0)
  startHour!: number;

  @Field(() => Int)
  @IsInt()
  @Max(MAX_MINUTE)
  @Min(0)
  startMin!: number;

  @Field(() => Int, { defaultValue: 4 })
  @IsInt()
  @Max(MAX_WEEKS_AHEAD)
  @Min(1)
  weeksAhead!: number;
}
