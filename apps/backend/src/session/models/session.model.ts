import { Field, ID, ObjectType } from '@nestjs/graphql';

import { SessionStatus } from './session-status.enum';

@ObjectType()
export class SessionModel {
  @Field(() => ID)
  arenaId!: number;

  @Field(() => String, { nullable: true })
  comment?: null | string;

  @Field()
  createdAt!: Date;

  @Field()
  endTime!: Date;

  @Field(() => ID)
  id!: number;

  @Field(() => String, { nullable: true })
  playerName?: null | string;

  @Field(() => ID, { nullable: true })
  recurringGroupId?: null | number;

  @Field()
  startTime!: Date;

  @Field(() => SessionStatus)
  status!: SessionStatus;

  @Field()
  updatedAt!: Date;

  @Field(() => ID, { nullable: true })
  userId?: null | number;
}
