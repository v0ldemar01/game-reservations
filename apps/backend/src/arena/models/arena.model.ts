import { ObjectType, Field, ID } from "@nestjs/graphql";

@ObjectType()
export class ArenaModel {
  @Field(() => ID)
  id!: number;

  @Field()
  name!: string;

  @Field()
  createdAt!: Date;
}
