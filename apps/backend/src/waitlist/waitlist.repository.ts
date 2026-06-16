import { Injectable } from "@nestjs/common";
import { Prisma, WaitlistEntry } from "@prisma/client";
import { DatabaseService } from "src/database/database.service";

export const WAITLIST_REPOSITORY = Symbol("WAITLIST_REPOSITORY");

export interface CreateWaitlistData {
  arenaId: number;
  userId: number;
  startTime: Date;
  endTime: Date;
}

export interface IWaitlistRepository {
  create(data: CreateWaitlistData): Promise<WaitlistEntry>;
  findOne(id: number): Promise<WaitlistEntry | null>;
  findByUserId(userId: number): Promise<WaitlistEntry[]>;
  delete(id: number): Promise<WaitlistEntry>;
  findFirstUnnotified(
    arenaId: number,
    startTime: Date,
    endTime: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<WaitlistEntry | null>;
  markNotified(
    id: number,
    tx?: Prisma.TransactionClient,
  ): Promise<WaitlistEntry>;
}

@Injectable()
export class WaitlistRepository implements IWaitlistRepository {
  constructor(private readonly db: DatabaseService) {}

  private client(tx?: Prisma.TransactionClient) {
    return tx ?? this.db;
  }

  create(data: CreateWaitlistData): Promise<WaitlistEntry> {
    return this.db.waitlistEntry.create({
      data: {
        arenaId: data.arenaId,
        userId: data.userId,
        startTime: data.startTime,
        endTime: data.endTime,
      },
    });
  }

  findOne(id: number): Promise<WaitlistEntry | null> {
    return this.db.waitlistEntry.findUnique({ where: { id } });
  }

  findByUserId(userId: number): Promise<WaitlistEntry[]> {
    return this.db.waitlistEntry.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
  }

  delete(id: number): Promise<WaitlistEntry> {
    return this.db.waitlistEntry.delete({ where: { id } });
  }

  findFirstUnnotified(
    arenaId: number,
    startTime: Date,
    endTime: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<WaitlistEntry | null> {
    return this.client(tx).waitlistEntry.findFirst({
      where: {
        arenaId,
        startTime: { lte: startTime },
        endTime: { gte: endTime },
        notifiedAt: null,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  markNotified(
    id: number,
    tx?: Prisma.TransactionClient,
  ): Promise<WaitlistEntry> {
    return this.client(tx).waitlistEntry.update({
      where: { id },
      data: { notifiedAt: new Date() },
    });
  }
}
