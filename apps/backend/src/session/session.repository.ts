import { Injectable } from '@nestjs/common';
import { Prisma, Session } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';

import { SessionStatus } from './models/session-status.enum';

export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');
export interface CreateSessionData {
  arenaId: number;
  comment?: string;
  endTime: Date;
  playerName?: string;
  recurringGroupId?: number;
  startTime: Date;
  status?: SessionStatus;
  userId?: number;
}
export interface ISessionRepository {
  countOverlapping(
    arenaId: number,
    startTime: Date,
    endTime: Date,
    excludeId?: number,
    tx?: Prisma.TransactionClient
  ): Promise<number>;
  create(
    data: CreateSessionData,
    tx?: Prisma.TransactionClient
  ): Promise<Session>;
  delete(id: number): Promise<Session>;
  findByArenaAndDateRange(
    arenaId: number,
    dayStart: Date,
    dayEnd: Date,
    page: number,
    pageSize: number
  ): Promise<{
    items: Session[];
    page: number;
    pageSize: number;
    total: number;
  }>;
  findEndTimesInRange(
    arenaId: number,
    from: Date,
    searchEnd: Date,
    excludeId?: number
  ): Promise<{ endTime: Date }[]>;
  findOne(id: number): Promise<null | Session>;
  lockOverlappingRows(
    tx: Prisma.TransactionClient,
    arenaId: number,
    startTime: Date,
    endTime: Date,
    excludeId?: number
  ): Promise<void>;
  update(
    id: number,
    data: UpdateSessionData,
    tx?: Prisma.TransactionClient
  ): Promise<Session>;
}
export interface UpdateSessionData {
  comment?: string;
  endTime?: Date;
  playerName?: string;
  startTime?: Date;
  status?: SessionStatus;
}
@Injectable()
export class SessionRepository implements ISessionRepository {
  constructor(private readonly db: DatabaseService) {}

  async countOverlapping(
    arenaId: number,
    startTime: Date,
    endTime: Date,
    excludeId?: number,
    tx?: Prisma.TransactionClient
  ): Promise<number> {
    // Count the PEAK concurrent sessions within [startTime, endTime), not the
    // total overlapping sessions. The peak is found by checking at each
    // critical point (existing session start times within the window) how many
    // sessions are active simultaneously.
    type PeakRow = { peak: bigint };

    const [row] = await this.client(tx).$queryRaw<PeakRow[]>`
      WITH critical_times AS (
        SELECT ${startTime}::timestamptz AS t
        UNION ALL
        SELECT start_time FROM sessions
        WHERE arena_id   = ${arenaId}
          AND status     = ${SessionStatus.ACTIVE}::"SessionStatus"
          AND start_time >  ${startTime}::timestamptz
          AND start_time <  ${endTime}::timestamptz
          AND (${excludeId ?? null}::int IS NULL OR id != ${excludeId ?? null}::int)
      )
      SELECT COALESCE(MAX(cnt), 0)::bigint AS peak FROM (
        SELECT ct.t, COUNT(s.id) AS cnt
        FROM critical_times ct
        JOIN sessions s ON s.arena_id  = ${arenaId}
          AND s.status     = ${SessionStatus.ACTIVE}::"SessionStatus"
          AND s.start_time <= ct.t
          AND s.end_time   >  ct.t
          AND (${excludeId ?? null}::int IS NULL OR s.id != ${excludeId ?? null}::int)
        GROUP BY ct.t
      ) sub
    `;

    return Number(row.peak);
  }

  create(
    data: CreateSessionData,
    tx?: Prisma.TransactionClient
  ): Promise<Session> {
    return this.client(tx).session.create({
      data: {
        arenaId: data.arenaId,
        comment: data.comment,
        endTime: data.endTime,
        playerName: data.playerName,
        recurringGroupId: data.recurringGroupId,
        startTime: data.startTime,
        status: data.status,
        userId: data.userId
      }
    });
  }

  delete(id: number): Promise<Session> {
    return this.db.session.delete({ where: { id } });
  }

  async findByArenaAndDateRange(
    arenaId: number,
    dayStart: Date,
    dayEnd: Date,
    page: number,
    pageSize: number
  ): Promise<{
    items: Session[];
    page: number;
    pageSize: number;
    total: number;
  }> {
    const where: Prisma.SessionWhereInput = {
      arenaId,
      endTime: { gt: dayStart },
      startTime: { lt: dayEnd }
    };
    const [items, total] = await this.db.$transaction([
      this.db.session.findMany({
        orderBy: { startTime: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        where
      }),
      this.db.session.count({ where })
    ]);

    return { items, page, pageSize, total };
  }

  findEndTimesInRange(
    arenaId: number,
    from: Date,
    searchEnd: Date,
    excludeId?: number
  ): Promise<{ endTime: Date }[]> {
    return this.db.session.findMany({
      orderBy: { endTime: 'asc' },
      select: { endTime: true },
      where: {
        arenaId,
        endTime: { gt: from },
        startTime: { lt: searchEnd },
        ...(excludeId === undefined ? {} : { id: { not: excludeId } })
      }
    });
  }

  findOne(id: number): Promise<null | Session> {
    return this.db.session.findUnique({ where: { id } });
  }

  async lockOverlappingRows(
    tx: Prisma.TransactionClient,
    arenaId: number,
    startTime: Date,
    endTime: Date,
    excludeId?: number
  ): Promise<void> {
    await tx.$queryRaw`
      SELECT id FROM sessions
      WHERE arena_id   = ${arenaId}
        AND status     = ${SessionStatus.ACTIVE}::"SessionStatus"
        AND end_time   > ${startTime}
        AND start_time < ${endTime}
        AND (${excludeId ?? null}::int IS NULL OR id != ${excludeId ?? null}::int)
      FOR UPDATE
    `;
  }

  update(
    id: number,
    data: UpdateSessionData,
    tx?: Prisma.TransactionClient
  ): Promise<Session> {
    return this.client(tx).session.update({
      data: {
        comment: data.comment,
        endTime: data.endTime,
        playerName: data.playerName,
        startTime: data.startTime,
        status: data.status
      },
      where: { id }
    });
  }

  private client(
    tx?: Prisma.TransactionClient
  ): DatabaseService | Prisma.TransactionClient {
    return tx ?? this.db;
  }
}
