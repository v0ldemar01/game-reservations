import { Test, type TestingModule } from '@nestjs/testing';
import { type Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';

import { WaitlistRepository } from './waitlist.repository';

function makeEntry(
  overrides: Partial<{
    arenaId: number;
    createdAt: Date;
    endTime: Date;
    id: number;
    notifiedAt: Date | null;
    startTime: Date;
    userId: number;
  }> = {}
) {
  return {
    arenaId: 1,
    createdAt: new Date(),
    endTime: new Date('2024-06-01T11:00:00Z'),
    id: 1,
    notifiedAt: null,
    startTime: new Date('2024-06-01T10:00:00Z'),
    userId: 10,
    ...overrides
  };
}

describe('WaitlistRepository', () => {
  let repo: WaitlistRepository;
  let db: {
    waitlistEntry: {
      create: jest.Mock;
      delete: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let mockTx: {
    waitlistEntry: { findFirst: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    mockTx = {
      waitlistEntry: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest
          .fn()
          .mockResolvedValue(makeEntry({ notifiedAt: new Date() }))
      }
    };

    db = {
      waitlistEntry: {
        create: jest.fn().mockResolvedValue(makeEntry()),
        delete: jest.fn().mockResolvedValue(makeEntry()),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest
          .fn()
          .mockResolvedValue(makeEntry({ notifiedAt: new Date() }))
      }
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaitlistRepository,
        { provide: DatabaseService, useValue: db }
      ]
    }).compile();

    repo = module.get(WaitlistRepository);
  });

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('creates entry with provided fields', async () => {
      const data = {
        arenaId: 1,
        endTime: new Date('2024-06-01T11:00:00Z'),
        startTime: new Date('2024-06-01T10:00:00Z'),
        userId: 10
      };
      await repo.create(data);
      expect(db.waitlistEntry.create).toHaveBeenCalledWith({ data });
    });
  });

  // ---------------------------------------------------------------------------
  // findFirstUnnotified
  // ---------------------------------------------------------------------------

  describe('findFirstUnnotified', () => {
    const arenaId = 1;
    const startTime = new Date('2024-06-01T10:00:00Z');
    const endTime = new Date('2024-06-01T11:00:00Z');

    it('queries with notifiedAt: null and correct time filters', async () => {
      await repo.findFirstUnnotified(arenaId, startTime, endTime);

      expect(db.waitlistEntry.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'asc' },
          where: expect.objectContaining({
            arenaId,
            endTime: { gte: endTime },
            notifiedAt: null,
            startTime: { lte: startTime }
          })
        })
      );
    });

    it('uses tx client when provided', async () => {
      await repo.findFirstUnnotified(
        arenaId,
        startTime,
        endTime,
        mockTx as unknown as Prisma.TransactionClient
      );

      expect(mockTx.waitlistEntry.findFirst).toHaveBeenCalledTimes(1);
      expect(db.waitlistEntry.findFirst).not.toHaveBeenCalled();
    });

    it('returns null when none found', async () => {
      db.waitlistEntry.findFirst.mockResolvedValue(null);
      await expect(
        repo.findFirstUnnotified(arenaId, startTime, endTime)
      ).resolves.toBeNull();
    });

    it('returns the entry when found', async () => {
      const entry = makeEntry({ id: 7 });
      db.waitlistEntry.findFirst.mockResolvedValue(entry);
      await expect(
        repo.findFirstUnnotified(arenaId, startTime, endTime)
      ).resolves.toEqual(entry);
    });
  });

  // ---------------------------------------------------------------------------
  // markNotified
  // ---------------------------------------------------------------------------

  describe('markNotified', () => {
    it('updates notifiedAt to a Date', async () => {
      await repo.markNotified(42);

      expect(db.waitlistEntry.update).toHaveBeenCalledWith({
        data: { notifiedAt: expect.any(Date) },
        where: { id: 42 }
      });
    });

    it('uses tx client when provided', async () => {
      await repo.markNotified(
        42,
        mockTx as unknown as Prisma.TransactionClient
      );

      expect(mockTx.waitlistEntry.update).toHaveBeenCalledTimes(1);
      expect(db.waitlistEntry.update).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // findOne / findByUserId / delete
  // ---------------------------------------------------------------------------

  describe('findOne', () => {
    it('returns null when not found', async () => {
      await expect(repo.findOne(99)).resolves.toBeNull();
    });

    it('delegates to findUnique', async () => {
      const entry = makeEntry();
      db.waitlistEntry.findUnique.mockResolvedValue(entry);
      await expect(repo.findOne(1)).resolves.toEqual(entry);
      expect(db.waitlistEntry.findUnique).toHaveBeenCalledWith({
        where: { id: 1 }
      });
    });
  });

  describe('findByUserId', () => {
    it('returns entries ordered by createdAt asc', async () => {
      const entries = [makeEntry()];
      db.waitlistEntry.findMany.mockResolvedValue(entries);

      const result = await repo.findByUserId(10);

      expect(result).toEqual(entries);
      expect(db.waitlistEntry.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'asc' },
        where: { userId: 10 }
      });
    });
  });

  describe('delete', () => {
    it('deletes by id', async () => {
      await repo.delete(5);
      expect(db.waitlistEntry.delete).toHaveBeenCalledWith({
        where: { id: 5 }
      });
    });
  });
});
