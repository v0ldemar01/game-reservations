import { InputType, Field, ID } from "@nestjs/graphql";
import { IsInt, IsDate, IsOptional } from "class-validator";
import { Type } from "class-transformer";

@InputType()
export class CheckAvailabilityInput {
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

  @Field(() => ID, {
    nullable: true,
    description: "Exclude this session id when checking (for updates)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  excludeSessionId?: number;
}
