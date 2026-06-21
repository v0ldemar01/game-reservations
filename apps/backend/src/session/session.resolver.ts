import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@game-reservations/shared';
import { ForbiddenException, UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { User } from '@prisma/client';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Role } from 'src/user/models/role.enum';

import { CheckAvailabilityInput } from './dto/check-availability.input';
import { CreateSessionInput } from './dto/create-session.input';
import { UpdateSessionInput } from './dto/update-session.input';
import { AvailabilityResult } from './models/availability.model';
import { SessionModel } from './models/session.model';
import { SessionsPage } from './models/sessions-page.model';
import { SessionService } from './session.service';

@Resolver(() => SessionModel)
export class SessionResolver {
  constructor(private readonly sessionService: SessionService) {}

  @Query(() => AvailabilityResult, {
    description:
      'Check if a time slot is available and optionally return suggestions'
  })
  async checkAvailability(
    @Args('input') input: CheckAvailabilityInput
  ): Promise<AvailabilityResult> {
    return await this.sessionService.checkAvailability(
      input.arenaId,
      input.startTime,
      input.endTime,
      input.excludeSessionId
    );
  }

  @Mutation(() => SessionModel, {
    description: 'Create a new session for an arena'
  })
  @UseGuards(JwtAuthGuard)
  createSession(
    @Args('input') input: CreateSessionInput,
    @CurrentUser() user: User
  ): Promise<SessionModel> {
    return this.sessionService.createSession({
      arenaId: input.arenaId,
      comment: input.comment,
      endTime: input.endTime,
      playerName: input.playerName,
      startTime: input.startTime,
      status: input.status,
      userId: user.id
    });
  }

  @Mutation(() => Boolean, { description: 'Delete a session by id' })
  @UseGuards(JwtAuthGuard)
  async deleteSession(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: User
  ): Promise<boolean> {
    await this.assertSessionOwnership(Number(id), user);

    return await this.sessionService.deleteSession(Number(id));
  }

  @Query(() => SessionsPage, {
    description:
      'Get paginated sessions for an arena that overlap the given local-time day window'
  })
  sessions(
    @Args('arenaId', { type: () => ID }) arenaId: string,
    @Args('dayStart') dayStart: string,
    @Args('dayEnd') dayEnd: string,
    @Args('page', { defaultValue: DEFAULT_PAGE, type: () => Int }) page: number,
    @Args('pageSize', { defaultValue: DEFAULT_PAGE_SIZE, type: () => Int })
    pageSize: number
  ): Promise<SessionsPage> {
    return this.sessionService.findByArenaAndDateRange(
      Number(arenaId),
      new Date(dayStart),
      new Date(dayEnd),
      page,
      pageSize
    );
  }

  @Mutation(() => SessionModel, { description: 'Update an existing session' })
  @UseGuards(JwtAuthGuard)
  async updateSession(
    @Args('input') input: UpdateSessionInput,
    @CurrentUser() user: User
  ): Promise<SessionModel> {
    await this.assertSessionOwnership(input.id, user);

    return await this.sessionService.updateSession({
      comment: input.comment,
      endTime: input.endTime,
      id: input.id,
      playerName: input.playerName,
      startTime: input.startTime,
      status: input.status
    });
  }

  private async assertSessionOwnership(
    sessionId: number,
    user: User
  ): Promise<void> {
    if (user.role === Role.ADMIN) {
      return;
    }

    const session = await this.sessionService.findOne(sessionId);

    if (session.userId !== user.id) {
      throw new ForbiddenException('You can only modify your own sessions');
    }
  }
}
