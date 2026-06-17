import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, MinLength } from 'class-validator';

const MIN_PASSWORD_LENGTH = 8;

@InputType()
export class RegisterInput {
  @Field()
  @IsEmail()
  email!: string;

  @Field()
  @MinLength(MIN_PASSWORD_LENGTH, {
    message: 'Password must be at least 8 characters'
  })
  password!: string;
}
