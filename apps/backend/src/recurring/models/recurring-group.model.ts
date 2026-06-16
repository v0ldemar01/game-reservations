import { ObjectType, Field, ID, Int } from "@nestjs/graphql";

@ObjectType()
export class RecurringGroupModel {
  @Field(() => ID)
  id!: number;

  @Field(() => ID)
  arenaId!: number;

  @Field(() => ID)
  userId!: number;

  @Field(() => Int)
  dayOfWeek!: number;

  @Field(() => Int)
  startHour!: number;

  @Field(() => Int)
  startMin!: number;

  @Field(() => Int)
  endHour!: number;

  @Field(() => Int)
  endMin!: number;

  @Field(() => Int)
  weeksAhead!: number;

  @Field(() => String, { nullable: true })
  playerName?: string | null;

  @Field(() => String, { nullable: true })
  comment?: string | null;

  @Field()
  createdAt!: Date;
}

@ObjectType()
export class RecurringCreateResult {
  @Field(() => RecurringGroupModel)
  group!: RecurringGroupModel;

  @Field(() => Int)
  createdCount!: number;

  @Field(() => Int)
  skippedCount!: number;
}
