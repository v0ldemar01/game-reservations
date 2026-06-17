import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class WaitlistEntryModel {
  @Field(() => ID)
  arenaId!: number;

  @Field()
  createdAt!: Date;

  @Field()
  endTime!: Date;

  @Field(() => ID)
  id!: number;

  @Field(() => Date, { nullable: true })
  notifiedAt?: Date | null;

  @Field()
  startTime!: Date;

  @Field(() => ID)
  userId!: number;
}
