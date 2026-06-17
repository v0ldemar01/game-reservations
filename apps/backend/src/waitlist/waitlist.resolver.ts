import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { User } from '@prisma/client';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

import { JoinWaitlistInput } from './dto/join-waitlist.input';
import { WaitlistEntryModel } from './models/waitlist-entry.model';
import { WaitlistService } from './waitlist.service';

@Resolver()
export class WaitlistResolver {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Mutation(() => WaitlistEntryModel, {
    description: 'Join the waitlist for a time slot'
  })
  @UseGuards(JwtAuthGuard)
  joinWaitlist(
    @Args('input') input: JoinWaitlistInput,
    @CurrentUser() user: User
  ): Promise<WaitlistEntryModel> {
    return this.waitlistService.join(input, user.id);
  }

  @Mutation(() => Boolean, { description: 'Remove yourself from the waitlist' })
  @UseGuards(JwtAuthGuard)
  leaveWaitlist(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() user: User
  ): Promise<boolean> {
    return this.waitlistService.leave(Number(id), user.id);
  }

  @Query(() => [WaitlistEntryModel], {
    description: 'Get your waitlist entries'
  })
  @UseGuards(JwtAuthGuard)
  myWaitlistEntries(@CurrentUser() user: User): Promise<WaitlistEntryModel[]> {
    return this.waitlistService.myEntries(user.id);
  }
}
