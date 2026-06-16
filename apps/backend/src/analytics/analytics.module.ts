import { Module } from "@nestjs/common";
import {
  AnalyticsRepository,
  ANALYTICS_REPOSITORY,
} from "./analytics.repository";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsResolver } from "./analytics.resolver";

@Module({
  providers: [
    AnalyticsRepository,
    { provide: ANALYTICS_REPOSITORY, useExisting: AnalyticsRepository },
    AnalyticsService,
    AnalyticsResolver,
  ],
})
export class AnalyticsModule {}
