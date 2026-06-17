import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { ValueOf } from 'src/common/types/types';

import { Role } from './role.enum.js';

registerEnumType(Role, { name: 'Role' });

@ObjectType()
export class UserModel {
  @Field()
  createdAt!: Date;

  @Field()
  email!: string;

  @Field(() => ID)
  id!: number;

  passwordHash!: string;

  @Field(() => Role)
  role!: ValueOf<typeof Role>;
}
