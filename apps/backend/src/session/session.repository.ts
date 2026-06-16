import { Injectable } from "@nestjs/common";
import { Prisma, Session } from "@prisma/client";
import { DatabaseService } from "src/database/database.service";
import { SessionStatus } from "./models/session-status.enum";

export const SESSION_REPOSITORY = Symbol("SESSION_REPOSITORY");

export interface CreateSessionData {
  arenaId: number;
  startTime: Date;
  endTime: Date;
  playerName?: string;
  comment?: string;
  status?: SessionStatus;
  userId?: number;
  recurringGroupId?: number;
}

export interface UpdateSessionData {
  startTime?: Date;
  endTime?: Date;
  playerName?: string;
  comment?: string;
  status?: SessionStatus;
}

export interface ISessionRepository {
  findByArenaAndDateRange(
    arenaId: number,
    dayStart: Date,
    dayEnd: Date,
    page: number,
    pageSize: number,
  ): Promise<{
    items: Session[];
    total: number;
    page: number;
    pageSize: number;
  }>;
  findOne(id: number): Promise<Session | null>;
  countOverlapping(
    arenaId: number,
    startTime: Date,
    endTime: Date,
    excludeId?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<number>;
  lockOverlappingRows(
    tx: Prisma.TransactionClient,
    arenaId: number,
    startTime: Date,
    endTime: Date,
    excludeId?: number,
  ): Promise<void>;
  findEndTimesInRange(
    arenaId: number,
    from: Date,
    searchEnd: Date,
    excludeId?: number,
  ): Promise<{ endTime: Date }[]>;
  create(
    data: CreateSessionData,
    tx?: Prisma.TransactionClient,
  ): Promise<Session>;
  update(
    id: number,
    data: UpdateSessionData,
    tx?: Prisma.TransactionClient,
  ): Promise<Session>;
  delete(id: number): Promise<Session>;
}

@Injectable()
export class SessionRepository implements ISessionRepository {
  constructor(private readonly db: DatabaseService) {}

  private client(tx?: Prisma.TransactionClient) {
    return tx ?? this.db;
  }

  async findByArenaAndDateRange(
    arenaId: number,
    dayStart: Date,
    dayEnd: Date,
    page: number,
    pageSize: number,
  ): Promise<{
    items: Session[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const where: Prisma.SessionWhereInput = {
      arenaId,
      startTime: { lt: dayEnd },
      endTime: { gt: dayStart },
    };
    const [items, total] = await this.db.$transaction([
      this.db.session.findMany({
        where,
        orderBy: { startTime: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.db.session.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  findOne(id: number): Promise<Session | null> {
    return this.db.session.findUnique({ where: { id } });
  }

  async countOverlapping(
    arenaId: number,
    startTime: Date,
    endTime: Date,
    excludeId?: number,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    type CountRow = { count: bigint };
    const client = this.client(tx);

    let rows: CountRow[];
    if (excludeId !== undefined) {
      rows = await client.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS count FROM sessions
        WHERE arena_id   = ${arenaId}
          AND start_time < ${endTime}
          AND end_time   > ${startTime}
          AND id        != ${excludeId}
      `;
    } else {
      rows = await client.$queryRaw<CountRow[]>`
        SELECT COUNT(*)::bigint AS count FROM sessions
        WHERE arena_id   = ${arenaId}
          AND start_time < ${endTime}
          AND end_time   > ${startTime}
      `;
    }

    return Number(rows[0].count);
  }

  async lockOverlappingRows(
    tx: Prisma.TransactionClient,
    arenaId: number,
    startTime: Date,
    endTime: Date,
    excludeId?: number,
  ): Promise<void> {
    if (excludeId !== undefined) {
      await tx.$queryRaw`
        SELECT id FROM sessions
        WHERE arena_id   = ${arenaId}
          AND start_time < ${endTime}
          AND end_time   > ${startTime}
          AND id        != ${excludeId}
        FOR UPDATE
      `;
    } else {
      await tx.$queryRaw`
        SELECT id FROM sessions
        WHERE arena_id   = ${arenaId}
          AND start_time < ${endTime}
          AND end_time   > ${startTime}
        FOR UPDATE
      `;
    }
  }

  findEndTimesInRange(
    arenaId: number,
    from: Date,
    searchEnd: Date,
    excludeId?: number,
  ): Promise<{ endTime: Date }[]> {
    return this.db.session.findMany({
      where: {
        arenaId,
        startTime: { lt: searchEnd },
        endTime: { gt: from },
        ...(excludeId !== undefined ? { id: { not: excludeId } } : {}),
      },
      select: { endTime: true },
      orderBy: { endTime: "asc" },
    });
  }

  create(
    data: CreateSessionData,
    tx?: Prisma.TransactionClient,
  ): Promise<Session> {
    return this.client(tx).session.create({
      data: {
        arenaId: data.arenaId,
        startTime: data.startTime,
        endTime: data.endTime,
        playerName: data.playerName,
        comment: data.comment,
        status: data.status,
        userId: data.userId,
        recurringGroupId: data.recurringGroupId,
      },
    });
  }

  update(
    id: number,
    data: UpdateSessionData,
    tx?: Prisma.TransactionClient,
  ): Promise<Session> {
    return this.client(tx).session.update({
      where: { id },
      data: {
        startTime: data.startTime,
        endTime: data.endTime,
        playerName: data.playerName,
        comment: data.comment,
        status: data.status,
      },
    });
  }

  delete(id: number): Promise<Session> {
    return this.db.session.delete({ where: { id } });
  }
}
