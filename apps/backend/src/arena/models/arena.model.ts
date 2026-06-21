import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ArenaModel {
  @Field()
  createdAt!: Date;

  @Field(() => ID)
  id!: number;

  @Field()
  name!: string;
}
