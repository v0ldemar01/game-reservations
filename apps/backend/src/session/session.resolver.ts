import { Resolver, Query, Mutation, Args, ID, Int } from "@nestjs/graphql";
import { UseGuards, ForbiddenException } from "@nestjs/common";
import { Role, User } from "@prisma/client";
import { SessionService } from "./session.service";
import { SessionModel } from "./models/session.model";
import { SessionsPage } from "./models/sessions-page.model";
import { AvailabilityResult } from "./models/availability.model";
import { CreateSessionInput } from "./dto/create-session.input";
import { UpdateSessionInput } from "./dto/update-session.input";
import { CheckAvailabilityInput } from "./dto/check-availability.input";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { CurrentUser } from "src/auth/decorators/current-user.decorator";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@game-reservations/shared";

@Resolver(() => SessionModel)
export class SessionResolver {
  constructor(private readonly sessionService: SessionService) {}

  @Query(() => SessionsPage, {
    description:
      "Get paginated sessions for an arena that overlap the given local-time day window",
  })
  sessions(
    @Args("arenaId", { type: () => ID }) arenaId: string,
    @Args("dayStart") dayStart: string,
    @Args("dayEnd") dayEnd: string,
    @Args("page", { type: () => Int, defaultValue: DEFAULT_PAGE }) page: number,
    @Args("pageSize", { type: () => Int, defaultValue: DEFAULT_PAGE_SIZE })
    pageSize: number,
  ): Promise<SessionsPage> {
    return this.sessionService.findByArenaAndDateRange(
      Number(arenaId),
      new Date(dayStart),
      new Date(dayEnd),
      page,
      pageSize,
    );
  }

  @Query(() => AvailabilityResult, {
    description:
      "Check if a time slot is available and optionally return suggestions",
  })
  async checkAvailability(
    @Args("input") input: CheckAvailabilityInput,
  ): Promise<AvailabilityResult> {
    return this.sessionService.checkAvailability(
      Number(input.arenaId),
      input.startTime,
      input.endTime,
      input.excludeSessionId ? Number(input.excludeSessionId) : undefined,
    );
  }

  @Mutation(() => SessionModel, {
    description: "Create a new session for an arena",
  })
  @UseGuards(JwtAuthGuard)
  createSession(
    @Args("input") input: CreateSessionInput,
    @CurrentUser() user: User,
  ): Promise<SessionModel> {
    return this.sessionService.createSession({
      ...input,
      arenaId: Number(input.arenaId),
      userId: user.id,
    });
  }

  @Mutation(() => SessionModel, { description: "Update an existing session" })
  @UseGuards(JwtAuthGuard)
  async updateSession(
    @Args("input") input: UpdateSessionInput,
    @CurrentUser() user: User,
  ): Promise<SessionModel> {
    await this.assertSessionOwnership(Number(input.id), user);
    return this.sessionService.updateSession({
      ...input,
      id: Number(input.id),
    });
  }

  @Mutation(() => Boolean, { description: "Delete a session by id" })
  @UseGuards(JwtAuthGuard)
  async deleteSession(
    @Args("id", { type: () => ID }) id: string,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    await this.assertSessionOwnership(Number(id), user);
    return this.sessionService.deleteSession(Number(id));
  }

  private async assertSessionOwnership(
    sessionId: number,
    user: User,
  ): Promise<void> {
    if (user.role === Role.ADMIN) return;
    const session = await this.sessionService.findOne(sessionId);
    if (session.userId !== user.id) {
      throw new ForbiddenException("You can only modify your own sessions");
    }
  }
}
