import { ObjectType, Field, ID } from "@nestjs/graphql";
import { SessionStatus } from "./session-status.enum";

@ObjectType()
export class SessionModel {
  @Field(() => ID)
  id!: number;

  @Field(() => ID)
  arenaId!: number;

  @Field(() => ID, { nullable: true })
  userId?: number | null;

  @Field()
  startTime!: Date;

  @Field()
  endTime!: Date;

  @Field(() => String, { nullable: true })
  playerName?: string | null;

  @Field(() => String, { nullable: true })
  comment?: string | null;

  @Field(() => SessionStatus)
  status!: SessionStatus;

  @Field(() => ID, { nullable: true })
  recurringGroupId?: number | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
