import { Injectable } from '@nestjs/common';
import { Prisma, WaitlistEntry } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';

export const WAITLIST_REPOSITORY = Symbol('WAITLIST_REPOSITORY');
export interface CreateWaitlistData {
  arenaId: number;
  endTime: Date;
  startTime: Date;
  userId: number;
}
export interface IWaitlistRepository {
  create(data: CreateWaitlistData): Promise<WaitlistEntry>;
  delete(id: number): Promise<WaitlistEntry>;
  findByUserId(userId: number): Promise<WaitlistEntry[]>;
  findFirstUnnotified(
    arenaId: number,
    startTime: Date,
    endTime: Date,
    tx?: Prisma.TransactionClient
  ): Promise<null | WaitlistEntry>;
  findOne(id: number): Promise<null | WaitlistEntry>;
  markNotified(
    id: number,
    tx?: Prisma.TransactionClient
  ): Promise<WaitlistEntry>;
}
@Injectable()
export class WaitlistRepository implements IWaitlistRepository {
  constructor(private readonly db: DatabaseService) {}

  create(data: CreateWaitlistData): Promise<WaitlistEntry> {
    return this.db.waitlistEntry.create({
      data: {
        arenaId: data.arenaId,
        endTime: data.endTime,
        startTime: data.startTime,
        userId: data.userId
      }
    });
  }

  delete(id: number): Promise<WaitlistEntry> {
    return this.db.waitlistEntry.delete({ where: { id } });
  }

  findByUserId(userId: number): Promise<WaitlistEntry[]> {
    return this.db.waitlistEntry.findMany({
      orderBy: { createdAt: 'asc' },
      where: { userId }
    });
  }

  findFirstUnnotified(
    arenaId: number,
    startTime: Date,
    endTime: Date,
    tx?: Prisma.TransactionClient
  ): Promise<null | WaitlistEntry> {
    return this.client(tx).waitlistEntry.findFirst({
      orderBy: { createdAt: 'asc' },
      where: {
        arenaId,
        endTime: { gte: endTime },
        notifiedAt: null,
        startTime: { lte: startTime }
      }
    });
  }

  findOne(id: number): Promise<null | WaitlistEntry> {
    return this.db.waitlistEntry.findUnique({ where: { id } });
  }

  markNotified(
    id: number,
    tx?: Prisma.TransactionClient
  ): Promise<WaitlistEntry> {
    return this.client(tx).waitlistEntry.update({
      data: { notifiedAt: new Date() },
      where: { id }
    });
  }

  private client(
    tx?: Prisma.TransactionClient
  ): DatabaseService | Prisma.TransactionClient {
    return tx ?? this.db;
  }
}
