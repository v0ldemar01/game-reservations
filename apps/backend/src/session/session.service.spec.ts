import {
  BadRequestException,
  ConflictException,
  NotFoundException
} from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { type Prisma } from '@prisma/client';
import { AdvisoryLocks } from 'src/common/advisory-locks';
import { DatabaseService } from 'src/database/database.service';

import { SessionStatus } from './models/session-status.enum';
import {
  type ISessionRepository,
  SESSION_REPOSITORY
} from './session.repository';
import { SessionService } from './session.service';

const ARENA_ID = 1;

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
  const now = new Date();

  return {
    arenaId: ARENA_ID,
    comment: null,
    createdAt: now,
    endTime: makeDate(1),
    id: 1,
    playerName: null,
    recurringGroupId: null,
    startTime: makeDate(0),
    status: SessionStatus.ACTIVE,
    updatedAt: now,
    userId: null,
    ...overrides
  };
}

describe('SessionService', () => {
  let service: SessionService;
  let sessionRepo: jest.Mocked<ISessionRepository>;
  let db: { withAdvisoryXactLock: jest.Mock; withTransaction: jest.Mock };

  const mockTx = {} as Prisma.TransactionClient;

  beforeEach(async () => {
    sessionRepo = {
      countOverlapping: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findByArenaAndDateRange: jest.fn(),
      findEndTimesInRange: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      lockOverlappingRows: jest.fn().mockResolvedValue(undefined),
      update: jest.fn()
    };

    db = {
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
        SessionService,
        { provide: SESSION_REPOSITORY, useValue: sessionRepo },
        { provide: DatabaseService, useValue: db }
      ]
    }).compile();

    service = module.get(SessionService);
  });

  // ---------------------------------------------------------------------------
  // Duration validation
  // ---------------------------------------------------------------------------

  describe('validateDuration', () => {
    it('throws BadRequestException when end <= start', async () => {
      await expect(
        service.createSession({
          arenaId: ARENA_ID,
          endTime: makeDate(0),
          startTime: makeDate(1)
        })
      ).rejects.toThrow(BadRequestException);
      expect(db.withTransaction).not.toHaveBeenCalled();
    });

    it('throws when duration < 5 minutes', async () => {
      const start = makeDate(0);
      await expect(
        service.createSession({
          arenaId: ARENA_ID,
          endTime: new Date(start.getTime() + 4 * 60_000),
          startTime: start
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when duration > 24 hours', async () => {
      const start = makeDate(0);
      await expect(
        service.createSession({
          arenaId: ARENA_ID,
          endTime: new Date(start.getTime() + 25 * 3_600_000),
          startTime: start
        })
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts exactly 5 minutes', async () => {
      const start = makeDate(0);
      const end = new Date(start.getTime() + 5 * 60_000);
      const created = makeSession({ endTime: end, startTime: start });
      sessionRepo.countOverlapping.mockResolvedValue(0);
      sessionRepo.create.mockResolvedValue(created);

      await expect(
        service.createSession({
          arenaId: ARENA_ID,
          endTime: end,
          startTime: start
        })
      ).resolves.toEqual(created);
    });

    it('accepts exactly 24 hours', async () => {
      const start = makeDate(0);
      const end = new Date(start.getTime() + 24 * 3_600_000);
      const created = makeSession({ endTime: end, startTime: start });
      sessionRepo.countOverlapping.mockResolvedValue(0);
      sessionRepo.create.mockResolvedValue(created);

      await expect(
        service.createSession({
          arenaId: ARENA_ID,
          endTime: end,
          startTime: start
        })
      ).resolves.toEqual(created);
    });
  });

  // ---------------------------------------------------------------------------
  // createSession
  // ---------------------------------------------------------------------------

  describe('createSession', () => {
    const start = makeDate(0);
    const end = makeDate(1);

    it('acquires advisory xact lock with correct arenaId key', async () => {
      sessionRepo.countOverlapping.mockResolvedValue(0);
      sessionRepo.create.mockResolvedValue(makeSession());

      await service.createSession({
        arenaId: ARENA_ID,
        endTime: end,
        startTime: start
      });

      expect(db.withAdvisoryXactLock).toHaveBeenCalledWith(
        mockTx,
        AdvisoryLocks.sessionWrite(ARENA_ID),
        expect.any(Function)
      );
    });

    it('calls lockOverlappingRows with tx', async () => {
      sessionRepo.countOverlapping.mockResolvedValue(0);
      sessionRepo.create.mockResolvedValue(makeSession());

      await service.createSession({
        arenaId: ARENA_ID,
        endTime: end,
        startTime: start
      });

      expect(sessionRepo.lockOverlappingRows).toHaveBeenCalledWith(
        mockTx,
        ARENA_ID,
        start,
        end
      );
    });

    it('throws ConflictException with suggestedSlots when 5 overlap', async () => {
      sessionRepo.countOverlapping
        .mockResolvedValueOnce(5) // inside tx — triggers conflict
        .mockResolvedValue(0); // inside findSuggestedSlots probes
      sessionRepo.findEndTimesInRange.mockResolvedValue([]);

      const error = await service
        .createSession({ arenaId: ARENA_ID, endTime: end, startTime: start })
        .catch((error_) => error_);

      expect(error).toBeInstanceOf(ConflictException);
      expect(error.getResponse()).toMatchObject({
        message: expect.any(String),
        suggestedSlots: expect.any(Array)
      });
    });

    it('succeeds when exactly 4 sessions overlap', async () => {
      const created = makeSession();
      sessionRepo.countOverlapping.mockResolvedValue(4);
      sessionRepo.create.mockResolvedValue(created);

      await expect(
        service.createSession({
          arenaId: ARENA_ID,
          endTime: end,
          startTime: start
        })
      ).resolves.toEqual(created);
      expect(sessionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ arenaId: ARENA_ID }),
        mockTx
      );
    });

    it('passes userId to create when provided', async () => {
      sessionRepo.countOverlapping.mockResolvedValue(0);
      sessionRepo.create.mockResolvedValue(makeSession({ userId: 7 }));

      await service.createSession({
        arenaId: ARENA_ID,
        endTime: end,
        startTime: start,
        userId: 7
      });

      expect(sessionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 7 }),
        mockTx
      );
    });
  });

  // ---------------------------------------------------------------------------
  // updateSession
  // ---------------------------------------------------------------------------

  describe('updateSession', () => {
    it('throws NotFoundException when session does not exist', async () => {
      sessionRepo.findOne.mockResolvedValue(null);
      await expect(service.updateSession({ id: 99 })).rejects.toThrow(
        NotFoundException
      );
    });

    it('wraps in a transaction and excludes self from overlap count', async () => {
      const existing = makeSession({ id: 42 });
      sessionRepo.findOne.mockResolvedValue(existing);
      sessionRepo.countOverlapping.mockResolvedValue(3);
      sessionRepo.update.mockResolvedValue(existing);

      await service.updateSession({ id: 42 });

      expect(db.withTransaction).toHaveBeenCalledTimes(1);
      expect(sessionRepo.countOverlapping).toHaveBeenCalledWith(
        existing.arenaId,
        expect.any(Date),
        expect.any(Date),
        42,
        mockTx
      );
    });

    it('calls lockOverlappingRows with excludeId', async () => {
      const existing = makeSession({ id: 42 });
      sessionRepo.findOne.mockResolvedValue(existing);
      sessionRepo.countOverlapping.mockResolvedValue(0);
      sessionRepo.update.mockResolvedValue(existing);

      await service.updateSession({ id: 42 });

      expect(sessionRepo.lockOverlappingRows).toHaveBeenCalledWith(
        mockTx,
        existing.arenaId,
        expect.any(Date),
        expect.any(Date),
        42
      );
    });

    it('acquires advisory xact lock with arenaId from existing session', async () => {
      const existing = makeSession({ arenaId: 7, id: 42 });
      sessionRepo.findOne.mockResolvedValue(existing);
      sessionRepo.countOverlapping.mockResolvedValue(0);
      sessionRepo.update.mockResolvedValue(existing);

      await service.updateSession({ id: 42 });

      expect(db.withAdvisoryXactLock).toHaveBeenCalledWith(
        mockTx,
        AdvisoryLocks.sessionWrite(7),
        expect.any(Function)
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findOne / deleteSession
  // ---------------------------------------------------------------------------

  describe('findOne', () => {
    it('throws NotFoundException when not found', async () => {
      sessionRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it('returns session when found', async () => {
      const session = makeSession();
      sessionRepo.findOne.mockResolvedValue(session);
      await expect(service.findOne(1)).resolves.toEqual(session);
    });
  });

  describe('deleteSession', () => {
    it('delegates to sessionRepo.delete', async () => {
      const session = makeSession();
      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.delete.mockResolvedValue(session);

      await expect(service.deleteSession(1)).resolves.toBe(true);
      expect(sessionRepo.delete).toHaveBeenCalledWith(1);
    });

    it('throws NotFoundException for non-existent session', async () => {
      sessionRepo.findOne.mockResolvedValue(null);
      await expect(service.deleteSession(999)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  // ---------------------------------------------------------------------------
  // checkAvailability
  // ---------------------------------------------------------------------------

  describe('checkAvailability', () => {
    const start = makeDate(0);
    const end = makeDate(1);

    it('returns available:true when overlap count < 5', async () => {
      sessionRepo.countOverlapping.mockResolvedValue(4);
      await expect(
        service.checkAvailability(ARENA_ID, start, end)
      ).resolves.toEqual({ available: true });
    });

    it('returns available:false with suggestedSlots when overlap count = 5', async () => {
      sessionRepo.countOverlapping
        .mockResolvedValueOnce(5) // initial check
        .mockResolvedValue(0); // suggestion probes
      sessionRepo.findEndTimesInRange.mockResolvedValue([]);

      const result = await service.checkAvailability(ARENA_ID, start, end);

      expect(result.available).toBe(false);
      expect(result.suggestedSlots).toBeInstanceOf(Array);
    });

    it('passes excludeSessionId to countOverlapping', async () => {
      sessionRepo.countOverlapping.mockResolvedValue(0);

      await service.checkAvailability(ARENA_ID, start, end, 42);

      expect(sessionRepo.countOverlapping).toHaveBeenCalledWith(
        ARENA_ID,
        start,
        end,
        42
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findByArenaAndDateRange
  // ---------------------------------------------------------------------------

  describe('findByArenaAndDateRange', () => {
    it('delegates to sessionRepo', async () => {
      const result = { items: [], page: 1, pageSize: 10, total: 0 };
      sessionRepo.findByArenaAndDateRange.mockResolvedValue(result);

      const dayStart = makeDate(0);
      const dayEnd = makeDate(24);
      await expect(
        service.findByArenaAndDateRange(ARENA_ID, dayStart, dayEnd, 1, 10)
      ).resolves.toEqual(result);
      expect(sessionRepo.findByArenaAndDateRange).toHaveBeenCalledWith(
        ARENA_ID,
        dayStart,
        dayEnd,
        1,
        10
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Boundary: touching sessions must NOT conflict
  // ---------------------------------------------------------------------------

  describe('boundary sessions', () => {
    it('allows session starting exactly when another ends (count=0)', async () => {
      const start = makeDate(1);
      const end = makeDate(2);
      const created = makeSession({ endTime: end, id: 2, startTime: start });
      sessionRepo.countOverlapping.mockResolvedValue(0);
      sessionRepo.create.mockResolvedValue(created);

      await expect(
        service.createSession({
          arenaId: ARENA_ID,
          endTime: end,
          startTime: start
        })
      ).resolves.toEqual(created);
    });
  });
});
