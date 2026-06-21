import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class RecurringGroupModel {
  @Field(() => ID)
  arenaId!: number;

  @Field(() => String, { nullable: true })
  comment?: null | string;

  @Field()
  createdAt!: Date;

  @Field(() => Int)
  dayOfWeek!: number;

  @Field(() => Int)
  endHour!: number;

  @Field(() => Int)
  endMin!: number;

  @Field(() => ID)
  id!: number;

  @Field(() => String, { nullable: true })
  playerName?: null | string;

  @Field(() => Int)
  startHour!: number;

  @Field(() => Int)
  startMin!: number;

  @Field(() => ID)
  userId!: number;

  @Field(() => Int)
  weeksAhead!: number;
}
@ObjectType()
export class RecurringCreateResult {
  @Field(() => Int)
  createdCount!: number;

  @Field(() => RecurringGroupModel)
  group!: RecurringGroupModel;

  @Field(() => Int)
  skippedCount!: number;
}
