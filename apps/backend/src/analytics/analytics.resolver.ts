import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Query, Resolver } from '@nestjs/graphql';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Role } from 'src/user/models/role.enum';

import { AnalyticsService } from './analytics.service';
import {
  AnalyticsResult,
  ArenaUtilizationSummary
} from './models/analytics.model';

@Resolver()
export class AnalyticsResolver {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Query(() => AnalyticsResult, {
    description: 'Utilization analytics for a single arena'
  })
  @UseGuards(JwtAuthGuard)
  arenaAnalytics(
    @Args('arenaId', { type: () => ID }) arenaId: string,
    @Args('from', { description: 'ISO date string' }) from: string,
    @Args('to', { description: 'ISO date string' }) to: string
  ): Promise<AnalyticsResult> {
    return this.analyticsService.arenaAnalytics(
      Number(arenaId),
      new Date(from),
      new Date(to)
    );
  }

  @Query(() => [ArenaUtilizationSummary], {
    description: 'Top arenas by booked minutes (admin only)'
  })
  @Roles(Role.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  busiestArenas(
    @Args('from') from: string,
    @Args('to') to: string,
    @Args('limit', { defaultValue: 10, type: () => Int }) limit: number
  ): Promise<ArenaUtilizationSummary[]> {
    return this.analyticsService.busiestArenas(
      new Date(from),
      new Date(to),
      limit
    );
  }
}
