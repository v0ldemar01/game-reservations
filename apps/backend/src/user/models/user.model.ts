import { ObjectType, Field, ID, registerEnumType } from "@nestjs/graphql";
import { Role } from "@prisma/client";

registerEnumType(Role, { name: "Role" });

@ObjectType()
export class UserModel {
  @Field(() => ID)
  id!: number;

  @Field()
  email!: string;

  @Field(() => Role)
  role!: Role;

  @Field()
  createdAt!: Date;
}
