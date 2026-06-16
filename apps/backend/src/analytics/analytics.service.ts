import { Injectable, Inject } from "@nestjs/common";
import { Session } from "@prisma/client";
import {
  IAnalyticsRepository,
  ANALYTICS_REPOSITORY,
} from "./analytics.repository";
import {
  AnalyticsResult,
  DayUtilization,
  HourlyCount,
} from "./models/analytics.model";

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;
const MINUTES_PER_DAY = 24 * 60;
const HOURS_PER_DAY = 24;

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(ANALYTICS_REPOSITORY)
    private readonly analyticsRepo: IAnalyticsRepository,
  ) {}

  async arenaAnalytics(
    arenaId: number,
    from: Date,
    to: Date,
  ): Promise<AnalyticsResult> {
    const sessions = await this.analyticsRepo.findSessionsInRange(
      arenaId,
      from,
      to,
    );

    return {
      dailyUtilization: this.computeDailyUtilization(sessions, from, to),
      peakHours: this.computePeakHours(sessions, from, to),
    };
  }

  async busiestArenas(from: Date, to: Date, limit: number) {
    return this.analyticsRepo.busiestArenas(from, to, limit);
  }

  private computeDailyUtilization(
    sessions: Session[],
    from: Date,
    to: Date,
  ): DayUtilization[] {
    const minutesByDay = new Map<string, number>();

    for (const session of sessions) {
      const clampedStart = Math.max(
        session.startTime.getTime(),
        from.getTime(),
      );
      const clampedEnd = Math.min(session.endTime.getTime(), to.getTime());

      const dayCursor = new Date(clampedStart);
      dayCursor.setHours(0, 0, 0, 0);

      while (dayCursor.getTime() < clampedEnd) {
        const dayStartMs = dayCursor.getTime();
        const dayEndMs = dayStartMs + MS_PER_DAY;
        const overlapMs =
          Math.min(clampedEnd, dayEndMs) - Math.max(clampedStart, dayStartMs);

        if (overlapMs > 0) {
          const key = dayCursor.toISOString().slice(0, 10);
          minutesByDay.set(
            key,
            (minutesByDay.get(key) ?? 0) +
              Math.round(overlapMs / MS_PER_MINUTE),
          );
        }

        dayCursor.setDate(dayCursor.getDate() + 1);
      }
    }

    return Array.from(minutesByDay.entries())
      .map(([date, bookedMinutes]) => ({
        date,
        bookedMinutes,
        utilizationPercent: Math.min(
          100,
          (bookedMinutes / MINUTES_PER_DAY) * 100,
        ),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private computePeakHours(
    sessions: Session[],
    from: Date,
    to: Date,
  ): HourlyCount[] {
    const countsByHour = new Array<number>(HOURS_PER_DAY).fill(0);

    for (const session of sessions) {
      const cursor = new Date(session.startTime);
      cursor.setMinutes(0, 0, 0);

      while (cursor < session.endTime) {
        if (cursor >= from && cursor < to) {
          countsByHour[cursor.getHours()]++;
        }
        cursor.setTime(cursor.getTime() + MS_PER_HOUR);
      }
    }

    return countsByHour.map((count, hour) => ({ hour, count }));
  }
}
