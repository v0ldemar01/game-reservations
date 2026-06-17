import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './prisma-health.indicator';

@Module({
  controllers: [HealthController],
  imports: [TerminusModule],
  providers: [PrismaHealthIndicator]
})
export class HealthModule {}
