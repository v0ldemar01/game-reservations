import { Field, ID, InputType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional } from 'class-validator';

@InputType()
export class CheckAvailabilityInput {
  @Field(() => ID)
  @IsInt()
  @Type(() => Number)
  arenaId!: number;

  @Field()
  @IsDate()
  @Type(() => Date)
  endTime!: Date;

  @Field(() => ID, {
    description: 'Exclude this session id when checking (for updates)',
    nullable: true
  })
  @IsInt()
  @IsOptional()
  @Type(() => Number)
  excludeSessionId?: number;

  @Field()
  @IsDate()
  @Type(() => Date)
  startTime!: Date;
}
