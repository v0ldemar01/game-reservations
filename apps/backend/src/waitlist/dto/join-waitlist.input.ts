import { InputType, Field, ID } from "@nestjs/graphql";
import { IsDate, IsNotEmpty } from "class-validator";
import { Type } from "class-transformer";

@InputType()
export class JoinWaitlistInput {
  @Field(() => ID)
  @IsNotEmpty()
  arenaId!: string;

  @Field()
  @IsDate()
  @Type(() => Date)
  startTime!: Date;

  @Field()
  @IsDate()
  @Type(() => Date)
  endTime!: Date;
}
