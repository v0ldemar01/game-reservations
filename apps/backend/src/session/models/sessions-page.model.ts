import { Field, Int, ObjectType } from '@nestjs/graphql';

import { SessionModel } from './session.model';

@ObjectType()
export class SessionsPage {
  @Field(() => [SessionModel])
  items!: SessionModel[];

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  total!: number;
}
