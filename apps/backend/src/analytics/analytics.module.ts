import { Module } from '@nestjs/common';

import {
  ANALYTICS_REPOSITORY,
  AnalyticsRepository
} from './analytics.repository';
import { AnalyticsResolver } from './analytics.resolver';
import { AnalyticsService } from './analytics.service';

@Module({
  providers: [
    AnalyticsRepository,
    { provide: ANALYTICS_REPOSITORY, useExisting: AnalyticsRepository },
    AnalyticsService,
    AnalyticsResolver
  ]
})
export class AnalyticsModule {}
