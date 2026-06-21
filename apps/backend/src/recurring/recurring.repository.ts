import { Injectable } from '@nestjs/common';
import { Prisma, RecurringGroup } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';

export const RECURRING_REPOSITORY = Symbol('RECURRING_REPOSITORY');
export interface CreateGroupData {
  arenaId: number;
  comment?: string;
  dayOfWeek: number;
  endHour: number;
  endMin: number;
  playerName?: string;
  startHour: number;
  startMin: number;
  userId: number;
  weeksAhead: number;
}
export interface IRecurringRepository {
  createGroup(data: CreateGroupData): Promise<RecurringGroup>;
  deleteGroup(
    id: number,
    tx?: Prisma.TransactionClient
  ): Promise<RecurringGroup>;
  deleteSessions(
    groupId: number,
    futureOnly: boolean,
    tx?: Prisma.TransactionClient
  ): Promise<void>;
  findGroup(id: number): Promise<null | RecurringGroup>;
  findGroupOrThrow(id: number): Promise<RecurringGroup>;
}
@Injectable()
export class RecurringRepository implements IRecurringRepository {
  constructor(private readonly db: DatabaseService) {}

  createGroup(data: CreateGroupData): Promise<RecurringGroup> {
    return this.db.recurringGroup.create({
      data: {
        arenaId: data.arenaId,
        comment: data.comment,
        dayOfWeek: data.dayOfWeek,
        endHour: data.endHour,
        endMin: data.endMin,
        playerName: data.playerName,
        startHour: data.startHour,
        startMin: data.startMin,
        userId: data.userId,
        weeksAhead: data.weeksAhead
      }
    });
  }

  deleteGroup(
    id: number,
    tx?: Prisma.TransactionClient
  ): Promise<RecurringGroup> {
    return this.client(tx).recurringGroup.delete({ where: { id } });
  }

  async deleteSessions(
    groupId: number,
    futureOnly: boolean,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const now = new Date();
    await this.client(tx).session.deleteMany({
      where: {
        recurringGroupId: groupId,
        ...(futureOnly ? { startTime: { gt: now } } : {})
      }
    });
  }

  findGroup(id: number): Promise<null | RecurringGroup> {
    return this.db.recurringGroup.findUnique({ where: { id } });
  }

  findGroupOrThrow(id: number): Promise<RecurringGroup> {
    return this.db.recurringGroup.findUniqueOrThrow({ where: { id } });
  }

  private client(
    tx?: Prisma.TransactionClient
  ): DatabaseService | Prisma.TransactionClient {
    return tx ?? this.db;
  }
}
