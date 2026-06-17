import { Test, type TestingModule } from '@nestjs/testing';
import { type Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';

import { SessionStatus } from './models/session-status.enum';
import { SessionRepository } from './session.repository';

function makeDate(
  hoursOffset: number,
  base = new Date('2024-01-15T10:00:00Z')
): Date {
  return new Date(base.getTime() + hoursOffset * 3_600_000);
}

function makeSession(
  overrides: Partial<{
    arenaId: number;
    comment: null | string;
    createdAt: Date;
    endTime: Date;
    id: number;
    playerName: null | string;
    recurringGroupId: null | number;
    startTime: Date;
    status: SessionStatus;
    updatedAt: Date;
    userId: null | number;
  }> = {}
) {
  return {
    arenaId: 1,
    comment: null,
    createdAt: new Date(),
    endTime: makeDate(1),
    id: 1,
    playerName: null,
    recurringGroupId: null,
    startTime: makeDate(0),
    status: SessionStatus.ACTIVE,
    updatedAt: new Date(),
    userId: null,
    ...overrides
  };
}

describe('SessionRepository', () => {
  let repo: SessionRepository;
  let db: {
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
    session: {
      count: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let mockTx: {
    $queryRaw: jest.Mock;
    session: { create: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    mockTx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      session: { create: jest.fn(), update: jest.fn() }
    };

    db = {
      $queryRaw: jest.fn(),
      $transaction: jest.fn(),
      session: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue(makeSession()),
        delete: jest.fn().mockResolvedValue(makeSession()),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue(makeSession())
      }
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SessionRepository, { provide: DatabaseService, useValue: db }]
    }).compile();

    repo = module.get(SessionRepository);
  });

  // ---------------------------------------------------------------------------
  // findByArenaAndDateRange
  // ---------------------------------------------------------------------------

  describe('findByArenaAndDateRange', () => {
    it('queries with correct overlap filter and pagination', async () => {
      const sessions = [makeSession()];
      db.$transaction.mockResolvedValue([sessions, 7]);

      const result = await repo.findByArenaAndDateRange(
        1,
        makeDate(0),
        makeDate(24),
        2,
        5
      );

      expect(db.$transaction).toHaveBeenCalledWith([
        expect.anything(), // findMany promise
        expect.anything() // count promise
      ]);
      expect(result).toEqual({
        items: sessions,
        page: 2,
        pageSize: 5,
        total: 7
      });
    });

    it('passes skip/take based on page and pageSize', async () => {
      db.$transaction.mockResolvedValue([[], 0]);
      db.session.findMany.mockReturnValue(Promise.resolve([]));

      await repo.findByArenaAndDateRange(1, makeDate(0), makeDate(8), 3, 10);

      expect(db.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------

  describe('findOne', () => {
    it('returns null when not found', async () => {
      db.session.findUnique.mockResolvedValue(null);
      await expect(repo.findOne(99)).resolves.toBeNull();
    });

    it('returns session when found', async () => {
      const session = makeSession({ id: 5 });
      db.session.findUnique.mockResolvedValue(session);
      await expect(repo.findOne(5)).resolves.toEqual(session);
      expect(db.session.findUnique).toHaveBeenCalledWith({ where: { id: 5 } });
    });
  });

  // ---------------------------------------------------------------------------
  // countOverlapping
  // ---------------------------------------------------------------------------

  describe('countOverlapping', () => {
    it('returns peak count without excludeId', async () => {
      db.$queryRaw.mockResolvedValue([{ peak: 3n }]);

      const result = await repo.countOverlapping(1, makeDate(0), makeDate(1));

      expect(result).toBe(3);
      expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('returns peak count with excludeId', async () => {
      db.$queryRaw.mockResolvedValue([{ peak: 2n }]);

      const result = await repo.countOverlapping(
        1,
        makeDate(0),
        makeDate(1),
        42
      );

      expect(result).toBe(2);
      expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('uses transaction client when tx is provided', async () => {
      mockTx.$queryRaw.mockResolvedValue([{ peak: 1n }]);

      const result = await repo.countOverlapping(
        1,
        makeDate(0),
        makeDate(1),
        undefined,
        mockTx as unknown as Prisma.TransactionClient
      );

      expect(result).toBe(1);
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(db.$queryRaw).not.toHaveBeenCalled();
    });

    it('converts BigInt peak to number', async () => {
      db.$queryRaw.mockResolvedValue([{ peak: 5n }]);
      await expect(
        repo.countOverlapping(1, makeDate(0), makeDate(1))
      ).resolves.toBe(5);
    });
  });

  // ---------------------------------------------------------------------------
  // lockOverlappingRows
  // ---------------------------------------------------------------------------

  describe('lockOverlappingRows', () => {
    it('executes SELECT FOR UPDATE on the tx client', async () => {
      await repo.lockOverlappingRows(
        mockTx as unknown as Prisma.TransactionClient,
        1,
        makeDate(0),
        makeDate(1)
      );
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('still issues one query when excludeId is provided', async () => {
      await repo.lockOverlappingRows(
        mockTx as unknown as Prisma.TransactionClient,
        1,
        makeDate(0),
        makeDate(1),
        42
      );
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // findEndTimesInRange
  // ---------------------------------------------------------------------------

  describe('findEndTimesInRange', () => {
    it('returns endTime objects ordered ascending', async () => {
      const rows = [{ endTime: makeDate(1) }, { endTime: makeDate(2) }];
      db.session.findMany.mockResolvedValue(rows as never);

      const result = await repo.findEndTimesInRange(
        1,
        makeDate(0),
        makeDate(10)
      );

      expect(result).toEqual(rows);
      expect(db.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { endTime: 'asc' },
          select: { endTime: true }
        })
      );
    });

    it('adds NOT condition when excludeId is provided', async () => {
      db.session.findMany.mockResolvedValue([]);
      await repo.findEndTimesInRange(1, makeDate(0), makeDate(10), 99);

      expect(db.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { not: 99 } })
        })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // create / update / delete
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('uses tx client when provided', async () => {
      mockTx.session.create.mockResolvedValue(makeSession());
      const data = { arenaId: 1, endTime: makeDate(1), startTime: makeDate(0) };

      await repo.create(data, mockTx as unknown as Prisma.TransactionClient);

      expect(mockTx.session.create).toHaveBeenCalledTimes(1);
      expect(db.session.create).not.toHaveBeenCalled();
    });

    it('uses db client when no tx', async () => {
      const data = { arenaId: 1, endTime: makeDate(1), startTime: makeDate(0) };
      await repo.create(data);
      expect(db.session.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('uses tx client when provided', async () => {
      mockTx.session.update.mockResolvedValue(makeSession());

      await repo.update(
        1,
        { status: SessionStatus.ACTIVE },
        mockTx as unknown as Prisma.TransactionClient
      );

      expect(mockTx.session.update).toHaveBeenCalledTimes(1);
      expect(db.session.update).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('deletes by id', async () => {
      await repo.delete(5);
      expect(db.session.delete).toHaveBeenCalledWith({ where: { id: 5 } });
    });
  });
});
