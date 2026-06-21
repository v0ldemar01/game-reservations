import { Inject, Injectable } from '@nestjs/common';
import { Session } from '@prisma/client';

import {
  ANALYTICS_REPOSITORY,
  type BusiestArenaRow,
  IAnalyticsRepository
} from './analytics.repository';
import {
  AnalyticsResult,
  DayUtilization,
  HourlyCount
} from './models/analytics.model';

@Injectable()
export class AnalyticsService {
  private static readonly HOURS_PER_DAY = 24;

  private static readonly ISO_DATE_LENGTH = 10; // 'YYYY-MM-DD'.length

  private static readonly MAX_UTILIZATION_PERCENT = 100;

  private static readonly MINUTES_PER_DAY = 1440; // 24 * 60

  private static readonly MS_PER_DAY = 86_400_000;

  private static readonly MS_PER_HOUR = 3_600_000;

  private static readonly MS_PER_MINUTE = 60_000;

  constructor(
    @Inject(ANALYTICS_REPOSITORY)
    private readonly analyticsRepo: IAnalyticsRepository
  ) {}

  async arenaAnalytics(
    arenaId: number,
    from: Date,
    to: Date
  ): Promise<AnalyticsResult> {
    const sessions = await this.analyticsRepo.findSessionsInRange(
      arenaId,
      from,
      to
    );

    return {
      dailyUtilization: this.computeDailyUtilization(sessions, from, to),
      peakHours: this.computePeakHours(sessions, from, to)
    };
  }

  busiestArenas(
    from: Date,
    to: Date,
    limit: number
  ): Promise<BusiestArenaRow[]> {
    return this.analyticsRepo.busiestArenas(from, to, limit);
  }

  private computeDailyUtilization(
    sessions: Session[],
    from: Date,
    to: Date
  ): DayUtilization[] {
    const minutesByDay = new Map<string, number>();

    for (const session of sessions) {
      const clampedStart = Math.max(
        session.startTime.getTime(),
        from.getTime()
      );
      const clampedEnd = Math.min(session.endTime.getTime(), to.getTime());

      const dayCursor = new Date(clampedStart);
      dayCursor.setHours(0, 0, 0, 0);

      while (dayCursor.getTime() < clampedEnd) {
        const dayStartMs = dayCursor.getTime();
        const dayEndMs = dayStartMs + AnalyticsService.MS_PER_DAY;
        const overlapMs =
          Math.min(clampedEnd, dayEndMs) - Math.max(clampedStart, dayStartMs);

        if (overlapMs > 0) {
          const key = dayCursor
            .toISOString()
            .slice(0, AnalyticsService.ISO_DATE_LENGTH);
          minutesByDay.set(
            key,
            (minutesByDay.get(key) ?? 0) +
              Math.round(overlapMs / AnalyticsService.MS_PER_MINUTE)
          );
        }

        dayCursor.setDate(dayCursor.getDate() + 1);
      }
    }

    return [...minutesByDay.entries()]
      .map(([date, bookedMinutes]) => ({
        bookedMinutes,
        date,
        utilizationPercent: Math.min(
          AnalyticsService.MAX_UTILIZATION_PERCENT,
          (bookedMinutes / AnalyticsService.MINUTES_PER_DAY) *
            AnalyticsService.MAX_UTILIZATION_PERCENT
        )
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private computePeakHours(
    sessions: Session[],
    from: Date,
    to: Date
  ): HourlyCount[] {
    const countsByHour = Array.from(
      { length: AnalyticsService.HOURS_PER_DAY },
      () => 0
    );

    for (const session of sessions) {
      const cursor = new Date(session.startTime);
      cursor.setMinutes(0, 0, 0);

      while (cursor < session.endTime) {
        if (cursor >= from && cursor < to) {
          countsByHour[cursor.getHours()]++;
        }

        cursor.setTime(cursor.getTime() + AnalyticsService.MS_PER_HOUR);
      }
    }

    return countsByHour.map((count, hour) => ({ count, hour }));
  }
}
