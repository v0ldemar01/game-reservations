import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';

import { AuthService } from './auth.service';
import { LoginInput } from './dto/login.input';
import { RegisterInput } from './dto/register.input';
import { GqlThrottlerGuard } from './guards/gql-throttler.guard';
import { AuthPayload } from './models/auth-payload.model';

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => AuthPayload, {
    description: 'Log in with email and password'
  })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(GqlThrottlerGuard)
  login(@Args('input') input: LoginInput): Promise<AuthPayload> {
    return this.authService.login(input.email, input.password);
  }

  @Mutation(() => AuthPayload, { description: 'Register a new account' })
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(GqlThrottlerGuard)
  register(@Args('input') input: RegisterInput): Promise<AuthPayload> {
    return this.authService.register(input.email, input.password);
  }
}
