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
    type CountRow = { count: bigint };

    const client = this.client(tx);

    let rows: CountRow[];

    rows = await (excludeId === undefined
      ? client.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS count FROM sessions
        WHERE arena_id   = ${arenaId}
          AND start_time < ${endTime}
          AND end_time   > ${startTime}
      `
      : client.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS count FROM sessions
        WHERE arena_id   = ${arenaId}
          AND start_time < ${endTime}
          AND end_time   > ${startTime}
          AND id        != ${excludeId}
      `);

    return Number(rows[0].count);
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
    await (excludeId === undefined
      ? tx.$queryRaw`
        SELECT id FROM sessions
        WHERE arena_id   = ${arenaId}
          AND start_time < ${endTime}
          AND end_time   > ${startTime}
        FOR UPDATE
      `
      : tx.$queryRaw`
        SELECT id FROM sessions
        WHERE arena_id   = ${arenaId}
          AND start_time < ${endTime}
          AND end_time   > ${startTime}
          AND id        != ${excludeId}
        FOR UPDATE
      `);
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
