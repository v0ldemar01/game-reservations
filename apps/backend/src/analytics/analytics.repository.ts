import { Injectable } from "@nestjs/common";
import { Session } from "@prisma/client";
import { DatabaseService } from "src/database/database.service";

export const ANALYTICS_REPOSITORY = Symbol("ANALYTICS_REPOSITORY");

export interface BusiestArenaRow {
  arenaId: number;
  arenaName: string;
  totalBookedMinutes: number;
  sessionCount: number;
}

export interface IAnalyticsRepository {
  findSessionsInRange(
    arenaId: number,
    from: Date,
    to: Date,
  ): Promise<Session[]>;
  busiestArenas(
    from: Date,
    to: Date,
    limit: number,
  ): Promise<BusiestArenaRow[]>;
}

@Injectable()
export class AnalyticsRepository implements IAnalyticsRepository {
  constructor(private readonly db: DatabaseService) {}

  findSessionsInRange(
    arenaId: number,
    from: Date,
    to: Date,
  ): Promise<Session[]> {
    return this.db.session.findMany({
      where: {
        arenaId,
        startTime: { lt: to },
        endTime: { gt: from },
      },
    });
  }

  async busiestArenas(
    from: Date,
    to: Date,
    limit: number,
  ): Promise<BusiestArenaRow[]> {
    type Row = {
      arena_id: bigint;
      arena_name: string;
      total_minutes: bigint;
      session_count: bigint;
    };
    const rows = await this.db.$queryRaw<Row[]>`
      SELECT
        a.id            AS arena_id,
        a.name          AS arena_name,
        SUM(EXTRACT(EPOCH FROM (s.end_time - s.start_time)) / 60)::bigint AS total_minutes,
        COUNT(s.id)::bigint                                                 AS session_count
      FROM arenas a
      LEFT JOIN sessions s ON s.arena_id = a.id
        AND s.start_time < ${to}
        AND s.end_time   > ${from}
      GROUP BY a.id, a.name
      ORDER BY total_minutes DESC NULLS LAST
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      arenaId: Number(r.arena_id),
      arenaName: r.arena_name,
      totalBookedMinutes: Number(r.total_minutes ?? 0),
      sessionCount: Number(r.session_count ?? 0),
    }));
  }
}
