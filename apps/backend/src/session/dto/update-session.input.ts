import { InputType, Field, ID } from "@nestjs/graphql";
import {
  IsInt,
  IsDate,
  IsOptional,
  IsString,
  IsEnum,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import { SessionStatus } from "../models/session-status.enum";

@InputType()
export class UpdateSessionInput {
  @Field(() => ID)
  @Type(() => Number)
  @IsInt()
  id!: number;

  // Both startTime and endTime must be provided together or not at all.
  // Sending only one would silently create an invalid (start > end) state.
  @Field({ nullable: true })
  @ValidateIf(
    (o: UpdateSessionInput) =>
      o.startTime !== undefined || o.endTime !== undefined,
  )
  @IsDate()
  @Type(() => Date)
  startTime?: Date;

  @Field({ nullable: true })
  @ValidateIf(
    (o: UpdateSessionInput) =>
      o.startTime !== undefined || o.endTime !== undefined,
  )
  @IsDate()
  @Type(() => Date)
  endTime?: Date;

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
