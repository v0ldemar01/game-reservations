import { InputType, Field, ID } from "@nestjs/graphql";
import {
  IsInt,
  IsDate,
  IsOptional,
  IsString,
  IsEnum,
  MaxLength,
  MinLength,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { SessionStatus } from "../models/session-status.enum";

@InputType()
export class CreateSessionInput {
  @Field(() => ID)
  @Type(() => Number)
  @IsInt()
  arenaId!: number;

  @Field()
  @IsDate()
  @Type(() => Date)
  startTime!: Date;

  @Field()
  @IsDate()
  @Type(() => Date)
  endTime!: Date;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "playerName must not be an empty string" })
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() || undefined : value,
  )
  playerName?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: "comment must not be an empty string" })
  @MaxLength(500)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() || undefined : value,
  )
  comment?: string;

  @Field(() => SessionStatus, { nullable: true })
  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;
}
