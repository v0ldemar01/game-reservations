import { Resolver, Mutation, Args } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { AuthPayload } from "./models/auth-payload.model";
import { RegisterInput } from "./dto/register.input";
import { LoginInput } from "./dto/login.input";
import { GqlThrottlerGuard } from "./guards/gql-throttler.guard";
import { Throttle } from "@nestjs/throttler";

@Resolver()
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => AuthPayload, { description: "Register a new account" })
  @UseGuards(GqlThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  register(@Args("input") input: RegisterInput): Promise<AuthPayload> {
    return this.authService.register(input.email, input.password);
  }

  @Mutation(() => AuthPayload, {
    description: "Log in with email and password",
  })
  @UseGuards(GqlThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Args("input") input: LoginInput): Promise<AuthPayload> {
    return this.authService.login(input.email, input.password);
  }
}
