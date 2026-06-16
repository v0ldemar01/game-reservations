import { ObjectType, Field, Int } from "@nestjs/graphql";
import { SessionModel } from "./session.model";

@ObjectType()
export class SessionsPage {
  @Field(() => [SessionModel])
  items!: SessionModel[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;
}
