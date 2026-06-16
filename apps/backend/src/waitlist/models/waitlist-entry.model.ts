import { ObjectType, Field, ID } from "@nestjs/graphql";

@ObjectType()
export class WaitlistEntryModel {
  @Field(() => ID)
  id!: number;

  @Field(() => ID)
  arenaId!: number;

  @Field(() => ID)
  userId!: number;

  @Field()
  startTime!: Date;

  @Field()
  endTime!: Date;

  @Field(() => Date, { nullable: true })
  notifiedAt?: Date | null;

  @Field()
  createdAt!: Date;
}
