import { Field, ObjectType } from '@nestjs/graphql';
import { UserModel } from 'src/user/models/user.model';

@ObjectType()
export class AuthPayload {
  @Field()
  token!: string;

  @Field(() => UserModel)
  user!: UserModel;
}
