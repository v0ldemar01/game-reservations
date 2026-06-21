import { Test, type TestingModule } from '@nestjs/testing';
import { type Prisma } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';

import { RecurringRepository } from './recurring.repository';

function makeGroup(
  overrides: Partial<{
    arenaId: number;
    comment: null | string;
    createdAt: Date;
    dayOfWeek: number;
    endHour: number;
    endMin: number;
    id: number;
    playerName: null | string;
    startHour: number;
    startMin: number;
    updatedAt: Date;
    userId: number;
    weeksAhead: number;
  }> = {}
) {
  return {
    arenaId: 1,
    comment: null,
    createdAt: new Date(),
    dayOfWeek: 1,
    endHour: 11,
    endMin: 0,
    id: 1,
    playerName: null,
    startHour: 10,
    startMin: 0,
    updatedAt: new Date(),
    userId: 10,
    weeksAhead: 4,
    ...overrides
  };
}

describe('RecurringRepository', () => {
  let repo: RecurringRepository;
  let db: {
    recurringGroup: {
      create: jest.Mock;
      delete: jest.Mock;
      findUnique: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    session: { deleteMany: jest.Mock };
  };
  let mockTx: {
    recurringGroup: { delete: jest.Mock };
    session: { deleteMany: jest.Mock };
  };

  beforeEach(async () => {
    mockTx = {
      recurringGroup: { delete: jest.fn().mockResolvedValue(makeGroup()) },
      session: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) }
    };

    db = {
      recurringGroup: {
        create: jest.fn().mockResolvedValue(makeGroup()),
        delete: jest.fn().mockResolvedValue(makeGroup()),
        findUnique: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn().mockResolvedValue(makeGroup())
      },
      session: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 })
      }
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringRepository,
        { provide: DatabaseService, useValue: db }
      ]
    }).compile();

    repo = module.get(RecurringRepository);
  });

  // ---------------------------------------------------------------------------
  // createGroup
  // ---------------------------------------------------------------------------

  describe('createGroup', () => {
    it('creates with all provided fields', async () => {
      const data = {
        arenaId: 1,
        comment: 'weekly',
        dayOfWeek: 2,
        endHour: 10,
        endMin: 30,
        playerName: 'Alice',
        startHour: 9,
        startMin: 30,
        userId: 10,
        weeksAhead: 8
      };

      await repo.createGroup(data);

      expect(db.recurringGroup.create).toHaveBeenCalledWith({ data });
    });
  });

  // ---------------------------------------------------------------------------
  // findGroup / findGroupOrThrow
  // ---------------------------------------------------------------------------

  describe('findGroup', () => {
    it('returns null when not found', async () => {
      await expect(repo.findGroup(99)).resolves.toBeNull();
    });

    it('returns group when found', async () => {
      const group = makeGroup({ id: 5 });
      db.recurringGroup.findUnique.mockResolvedValue(group);
      await expect(repo.findGroup(5)).resolves.toEqual(group);
    });
  });

  describe('findGroupOrThrow', () => {
    it('returns group when found', async () => {
      const group = makeGroup({ id: 5 });
      db.recurringGroup.findUniqueOrThrow.mockResolvedValue(group);
      await expect(repo.findGroupOrThrow(5)).resolves.toEqual(group);
    });
  });

  // ---------------------------------------------------------------------------
  // deleteGroup
  // ---------------------------------------------------------------------------

  describe('deleteGroup', () => {
    it('uses db client by default', async () => {
      await repo.deleteGroup(1);
      expect(db.recurringGroup.delete).toHaveBeenCalledWith({
        where: { id: 1 }
      });
    });

    it('uses tx client when provided', async () => {
      await repo.deleteGroup(1, mockTx as unknown as Prisma.TransactionClient);
      expect(mockTx.recurringGroup.delete).toHaveBeenCalledTimes(1);
      expect(db.recurringGroup.delete).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // deleteSessions — futureOnly behavior
  // ---------------------------------------------------------------------------

  describe('deleteSessions', () => {
    it('deletes all sessions when futureOnly=false (no startTime filter)', async () => {
      await repo.deleteSessions(1, false);

      expect(db.session.deleteMany).toHaveBeenCalledWith({
        where: { recurringGroupId: 1 }
      });
    });

    it('adds startTime > now filter when futureOnly=true', async () => {
      const before = new Date();
      await repo.deleteSessions(1, true);
      const after = new Date();

      const [[call]] = db.session.deleteMany.mock.calls;
      expect(call.where.startTime.gt).toBeInstanceOf(Date);
      expect(call.where.startTime.gt.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      );
      expect(call.where.startTime.gt.getTime()).toBeLessThanOrEqual(
        after.getTime()
      );
    });

    it('uses tx client when provided', async () => {
      await repo.deleteSessions(
        1,
        false,
        mockTx as unknown as Prisma.TransactionClient
      );
      expect(mockTx.session.deleteMany).toHaveBeenCalledTimes(1);
      expect(db.session.deleteMany).not.toHaveBeenCalled();
    });
  });
});
