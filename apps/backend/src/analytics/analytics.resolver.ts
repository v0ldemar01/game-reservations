import { Resolver, Query, Args, ID, Int } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import {
  AnalyticsResult,
  ArenaUtilizationSummary,
} from "./models/analytics.model";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { Roles } from "src/auth/decorators/roles.decorator";
import { RolesGuard } from "src/auth/guards/roles.guard";
import { Role } from "@prisma/client";

@Resolver()
export class AnalyticsResolver {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Query(() => AnalyticsResult, {
    description: "Utilization analytics for a single arena",
  })
  @UseGuards(JwtAuthGuard)
  arenaAnalytics(
    @Args("arenaId", { type: () => ID }) arenaId: string,
    @Args("from", { description: "ISO date string" }) from: string,
    @Args("to", { description: "ISO date string" }) to: string,
  ): Promise<AnalyticsResult> {
    return this.analyticsService.arenaAnalytics(
      Number(arenaId),
      new Date(from),
      new Date(to),
    );
  }

  @Query(() => [ArenaUtilizationSummary], {
    description: "Top arenas by booked minutes (admin only)",
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  busiestArenas(
    @Args("from") from: string,
    @Args("to") to: string,
    @Args("limit", { type: () => Int, defaultValue: 10 }) limit: number,
  ): Promise<ArenaUtilizationSummary[]> {
    return this.analyticsService.busiestArenas(
      new Date(from),
      new Date(to),
      limit,
    );
  }
}
