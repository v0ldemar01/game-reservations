import { MAX_CONCURRENT_SESSIONS } from '@game-reservations/shared';
import { Test, type TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AdvisoryLocks } from 'src/common/advisory-locks';
import { DatabaseService } from 'src/database/database.service';
import {
  type ISessionRepository,
  SESSION_REPOSITORY
} from 'src/session/session.repository';
import { Role } from 'src/user/models/role.enum';

import {
  type IRecurringRepository,
  RECURRING_REPOSITORY
} from './recurring.repository';
import { RecurringService } from './recurring.service';

const REPEATABLE_READ = Prisma.TransactionIsolationLevel.RepeatableRead;

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

describe('RecurringService', () => {
  let service: RecurringService;
  let recurringRepo: jest.Mocked<IRecurringRepository>;
  let sessionRepo: jest.Mocked<
    Pick<ISessionRepository, 'countOverlapping' | 'create'>
  >;
  let db: {
    user: { findUnique: jest.Mock };
    withAdvisoryXactLock: jest.Mock;
    withTransaction: jest.Mock;
  };

  const mockTx = {} as Prisma.TransactionClient;

  beforeEach(async () => {
    recurringRepo = {
      createGroup: jest.fn(),
      deleteGroup: jest.fn(),
      deleteSessions: jest.fn().mockResolvedValue(undefined),
      findGroup: jest.fn(),
      findGroupOrThrow: jest.fn()
    };

    sessionRepo = {
      countOverlapping: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({})
    };

    db = {
      user: { findUnique: jest.fn() },
      withAdvisoryXactLock: jest
        .fn()
        .mockImplementation(
          (_tx: unknown, _key: unknown, fn: () => Promise<unknown>) => fn()
        ),
      withTransaction: jest
        .fn()
        .mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
          fn(mockTx)
        )
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringService,
        { provide: RECURRING_REPOSITORY, useValue: recurringRepo },
        { provide: SESSION_REPOSITORY, useValue: sessionRepo },
        { provide: DatabaseService, useValue: db }
      ]
    }).compile();

    service = module.get(RecurringService);
  });

  // ---------------------------------------------------------------------------
  // createRecurring
  // ---------------------------------------------------------------------------

  describe('createRecurring', () => {
    const baseInput = {
      arenaId: '1',
      comment: undefined,
      dayOfWeek: 1, // Monday
      endHour: 11,
      endMin: 0,
      playerName: undefined,
      startHour: 10,
      startMin: 0,
      weeksAhead: 4
    };

    it('creates the group before entering the transaction', async () => {
      const group = makeGroup();
      recurringRepo.createGroup.mockResolvedValue(group);

      await service.createRecurring(baseInput, 10);

      expect(recurringRepo.createGroup).toHaveBeenCalledWith(
        expect.objectContaining({ arenaId: 1, userId: 10 })
      );
    });

    it('uses RepeatableRead isolation for the transaction', async () => {
      recurringRepo.createGroup.mockResolvedValue(makeGroup());

      await service.createRecurring(baseInput, 10);

      expect(db.withTransaction).toHaveBeenCalledWith(expect.any(Function), {
        isolationLevel: REPEATABLE_READ
      });
    });

    it('acquires recurringCreate advisory lock for the arenaId', async () => {
      recurringRepo.createGroup.mockResolvedValue(makeGroup());

      await service.createRecurring(baseInput, 10);

      expect(db.withAdvisoryXactLock).toHaveBeenCalledWith(
        mockTx,
        AdvisoryLocks.recurringCreate(1),
        expect.any(Function)
      );
    });

    it('creates one session per occurrence when all slots are free', async () => {
      recurringRepo.createGroup.mockResolvedValue(makeGroup());
      sessionRepo.countOverlapping.mockResolvedValue(0);

      const result = await service.createRecurring(baseInput, 10);

      expect(result.createdCount).toBe(baseInput.weeksAhead);
      expect(result.skippedCount).toBe(0);
      expect(sessionRepo.create).toHaveBeenCalledTimes(baseInput.weeksAhead);
    });

    it('skips occurrences when MAX_CONCURRENT_SESSIONS is reached', async () => {
      recurringRepo.createGroup.mockResolvedValue(makeGroup());
      // First 2 slots full, remaining free
      sessionRepo.countOverlapping
        .mockResolvedValueOnce(MAX_CONCURRENT_SESSIONS)
        .mockResolvedValueOnce(MAX_CONCURRENT_SESSIONS)
        .mockResolvedValue(0);

      const result = await service.createRecurring(baseInput, 10);

      expect(result.skippedCount).toBe(2);
      expect(result.createdCount).toBe(baseInput.weeksAhead - 2);
    });

    it('attaches recurringGroupId to created sessions', async () => {
      const group = makeGroup({ id: 99 });
      recurringRepo.createGroup.mockResolvedValue(group);
      sessionRepo.countOverlapping.mockResolvedValue(0);

      await service.createRecurring(baseInput, 10);

      expect(sessionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ recurringGroupId: 99 }),
        mockTx
      );
    });

    it('returns group, createdCount, skippedCount', async () => {
      const group = makeGroup();
      recurringRepo.createGroup.mockResolvedValue(group);

      const result = await service.createRecurring(baseInput, 10);

      expect(result.group).toEqual(group);
      expect(typeof result.createdCount).toBe('number');
      expect(typeof result.skippedCount).toBe('number');
    });
  });

  // ---------------------------------------------------------------------------
  // cancelGroup
  // ---------------------------------------------------------------------------

  describe('cancelGroup', () => {
    it('allows owner to cancel their group', async () => {
      const group = makeGroup({ userId: 10 });
      recurringRepo.findGroupOrThrow.mockResolvedValue(group);
      recurringRepo.deleteGroup.mockResolvedValue(group);

      const result = await service.cancelGroup(1, 10, false);

      expect(recurringRepo.deleteSessions).toHaveBeenCalledWith(
        1,
        false,
        mockTx
      );
      expect(recurringRepo.deleteGroup).toHaveBeenCalledWith(1, mockTx);
      expect(result).toBe(true);
    });

    it('throws when non-owner non-admin tries to cancel', async () => {
      const group = makeGroup({ userId: 10 });
      recurringRepo.findGroupOrThrow.mockResolvedValue(group);
      db.user.findUnique.mockResolvedValue({ id: 99, role: Role.PLAYER });

      await expect(service.cancelGroup(1, 99, false)).rejects.toThrow(
        'Forbidden'
      );
    });

    it('allows ADMIN to cancel any group', async () => {
      const group = makeGroup({ userId: 10 });
      recurringRepo.findGroupOrThrow.mockResolvedValue(group);
      db.user.findUnique.mockResolvedValue({ id: 99, role: Role.ADMIN });
      recurringRepo.deleteGroup.mockResolvedValue(group);

      const result = await service.cancelGroup(1, 99, false);

      expect(result).toBe(true);
    });

    it('passes futureOnly=true to deleteSessions', async () => {
      const group = makeGroup({ userId: 10 });
      recurringRepo.findGroupOrThrow.mockResolvedValue(group);
      recurringRepo.deleteGroup.mockResolvedValue(group);

      await service.cancelGroup(1, 10, true);

      expect(recurringRepo.deleteSessions).toHaveBeenCalledWith(
        1,
        true,
        mockTx
      );
    });
  });
});
