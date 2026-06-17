import { Field, ID, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty } from 'class-validator';

@InputType()
export class JoinWaitlistInput {
  @Field(() => ID)
  @IsNotEmpty()
  arenaId!: string;

  @Field()
  @IsDate()
  @Type(() => Date)
  endTime!: Date;

  @Field()
  @IsDate()
  @Type(() => Date)
  startTime!: Date;
}
