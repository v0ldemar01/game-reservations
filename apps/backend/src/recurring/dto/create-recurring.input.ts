import { InputType, Field, ID, Int } from "@nestjs/graphql";
import {
  IsInt,
  IsNotEmpty,
  Min,
  Max,
  IsOptional,
  MinLength,
} from "class-validator";
import { Transform } from "class-transformer";

@InputType()
export class CreateRecurringInput {
  @Field(() => ID)
  @IsNotEmpty()
  arenaId!: string;

  @Field(() => Int, { description: "0=Sun, 1=Mon, … 6=Sat" })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  @Max(23)
  startHour!: number;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  @Max(59)
  startMin!: number;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  @Max(23)
  endHour!: number;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  @Max(59)
  endMin!: number;

  @Field(() => Int, { defaultValue: 4 })
  @IsInt()
  @Min(1)
  @Max(52)
  weeksAhead!: number;

  @Field({ nullable: true })
  @IsOptional()
  @MinLength(1)
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() || undefined : value,
  )
  playerName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === "string" ? value.trim() || undefined : value,
  )
  comment?: string;
}
