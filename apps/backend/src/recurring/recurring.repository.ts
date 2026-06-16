import { Injectable } from "@nestjs/common";
import { Prisma, RecurringGroup } from "@prisma/client";
import { DatabaseService } from "src/database/database.service";

export const RECURRING_REPOSITORY = Symbol("RECURRING_REPOSITORY");

export interface CreateGroupData {
  arenaId: number;
  userId: number;
  dayOfWeek: number;
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  weeksAhead: number;
  playerName?: string;
  comment?: string;
}

export interface IRecurringRepository {
  createGroup(data: CreateGroupData): Promise<RecurringGroup>;
  findGroup(id: number): Promise<RecurringGroup | null>;
  findGroupOrThrow(id: number): Promise<RecurringGroup>;
  deleteGroup(
    id: number,
    tx?: Prisma.TransactionClient,
  ): Promise<RecurringGroup>;
  deleteSessions(
    groupId: number,
    futureOnly: boolean,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
}

@Injectable()
export class RecurringRepository implements IRecurringRepository {
  constructor(private readonly db: DatabaseService) {}

  private client(tx?: Prisma.TransactionClient) {
    return tx ?? this.db;
  }

  createGroup(data: CreateGroupData): Promise<RecurringGroup> {
    return this.db.recurringGroup.create({
      data: {
        arenaId: data.arenaId,
        userId: data.userId,
        dayOfWeek: data.dayOfWeek,
        startHour: data.startHour,
        startMin: data.startMin,
        endHour: data.endHour,
        endMin: data.endMin,
        weeksAhead: data.weeksAhead,
        playerName: data.playerName,
        comment: data.comment,
      },
    });
  }

  findGroup(id: number): Promise<RecurringGroup | null> {
    return this.db.recurringGroup.findUnique({ where: { id } });
  }

  findGroupOrThrow(id: number): Promise<RecurringGroup> {
    return this.db.recurringGroup.findUniqueOrThrow({ where: { id } });
  }

  deleteGroup(
    id: number,
    tx?: Prisma.TransactionClient,
  ): Promise<RecurringGroup> {
    return this.client(tx).recurringGroup.delete({ where: { id } });
  }

  async deleteSessions(
    groupId: number,
    futureOnly: boolean,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const now = new Date();
    await this.client(tx).session.deleteMany({
      where: {
        recurringGroupId: groupId,
        ...(futureOnly ? { startTime: { gt: now } } : {}),
      },
    });
  }
}
