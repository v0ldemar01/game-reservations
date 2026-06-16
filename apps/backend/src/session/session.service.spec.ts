import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { SessionService } from "./session.service";
import { DatabaseService } from "src/database/database.service";
import { ISessionRepository, SESSION_REPOSITORY } from "./session.repository";
import { AdvisoryLocks } from "src/common/advisory-locks";
import { SessionStatus } from "./models/session-status.enum";

const ARENA_ID = 1;

function makeDate(
  hoursOffset: number,
  base = new Date("2024-01-15T10:00:00Z"),
): Date {
  return new Date(base.getTime() + hoursOffset * 3_600_000);
}

function makeSession(
  overrides: Partial<{
    id: number;
    arenaId: number;
    startTime: Date;
    endTime: Date;
    playerName: string | null;
    comment: string | null;
    status: SessionStatus;
    userId: number | null;
    recurringGroupId: number | null;
    createdAt: Date;
    updatedAt: Date;
  }> = {},
) {
  const now = new Date();
  return {
    id: 1,
    arenaId: ARENA_ID,
    startTime: makeDate(0),
    endTime: makeDate(1),
    playerName: null,
    comment: null,
    status: SessionStatus.ACTIVE,
    userId: null,
    recurringGroupId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("SessionService", () => {
  let service: SessionService;
  let sessionRepo: jest.Mocked<ISessionRepository>;
  let db: { withTransaction: jest.Mock; withAdvisoryXactLock: jest.Mock };

  const mockTx = {} as Prisma.TransactionClient;

  beforeEach(async () => {
    sessionRepo = {
      findByArenaAndDateRange: jest.fn(),
      findOne: jest.fn(),
      countOverlapping: jest.fn(),
      lockOverlappingRows: jest.fn().mockResolvedValue(undefined),
      findEndTimesInRange: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    db = {
      withTransaction: jest
        .fn()
        .mockImplementation((fn: (tx: unknown) => Promise<unknown>) =>
          fn(mockTx),
        ),
      withAdvisoryXactLock: jest
        .fn()
        .mockImplementation(
          (_tx: unknown, _key: unknown, fn: () => Promise<unknown>) => fn(),
        ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: SESSION_REPOSITORY, useValue: sessionRepo },
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();

    service = module.get(SessionService);
  });

  // ---------------------------------------------------------------------------
  // Duration validation
  // ---------------------------------------------------------------------------

  describe("validateDuration", () => {
    it("throws BadRequestException when end <= start", async () => {
      await expect(
        service.createSession({
          arenaId: ARENA_ID,
          startTime: makeDate(1),
          endTime: makeDate(0),
        }),
      ).rejects.toThrow(BadRequestException);
      expect(db.withTransaction).not.toHaveBeenCalled();
    });

    it("throws when duration < 5 minutes", async () => {
      const start = makeDate(0);
      await expect(
        service.createSession({
          arenaId: ARENA_ID,
          startTime: start,
          endTime: new Date(start.getTime() + 4 * 60_000),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("throws when duration > 24 hours", async () => {
      const start = makeDate(0);
      await expect(
        service.createSession({
          arenaId: ARENA_ID,
          startTime: start,
          endTime: new Date(start.getTime() + 25 * 3_600_000),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("accepts exactly 5 minutes", async () => {
      const start = makeDate(0);
      const end = new Date(start.getTime() + 5 * 60_000);
      const created = makeSession({ startTime: start, endTime: end });
      sessionRepo.countOverlapping.mockResolvedValue(0);
      sessionRepo.create.mockResolvedValue(created);

      await expect(
        service.createSession({
          arenaId: ARENA_ID,
          startTime: start,
          endTime: end,
        }),
      ).resolves.toEqual(created);
    });

    it("accepts exactly 24 hours", async () => {
      const start = makeDate(0);
      const end = new Date(start.getTime() + 24 * 3_600_000);
      const created = makeSession({ startTime: start, endTime: end });
      sessionRepo.countOverlapping.mockResolvedValue(0);
      sessionRepo.create.mockResolvedValue(created);

      await expect(
        service.createSession({
          arenaId: ARENA_ID,
          startTime: start,
          endTime: end,
        }),
      ).resolves.toEqual(created);
    });
  });

  // ---------------------------------------------------------------------------
  // createSession
  // ---------------------------------------------------------------------------

  describe("createSession", () => {
    const start = makeDate(0);
    const end = makeDate(1);

    it("acquires advisory xact lock with correct arenaId key", async () => {
      sessionRepo.countOverlapping.mockResolvedValue(0);
      sessionRepo.create.mockResolvedValue(makeSession());

      await service.createSession({
        arenaId: ARENA_ID,
        startTime: start,
        endTime: end,
      });

      expect(db.withAdvisoryXactLock).toHaveBeenCalledWith(
        mockTx,
        AdvisoryLocks.sessionWrite(ARENA_ID),
        expect.any(Function),
      );
    });

    it("calls lockOverlappingRows with tx", async () => {
      sessionRepo.countOverlapping.mockResolvedValue(0);
      sessionRepo.create.mockResolvedValue(makeSession());

      await service.createSession({
        arenaId: ARENA_ID,
        startTime: start,
        endTime: end,
      });

      expect(sessionRepo.lockOverlappingRows).toHaveBeenCalledWith(
        mockTx,
        ARENA_ID,
        start,
        end,
      );
    });

    it("throws ConflictException with suggestedSlots when 5 overlap", async () => {
      sessionRepo.countOverlapping
        .mockResolvedValueOnce(5) // inside tx — triggers conflict
        .mockResolvedValue(0); // inside findSuggestedSlots probes
      sessionRepo.findEndTimesInRange.mockResolvedValue([]);

      const err = await service
        .createSession({ arenaId: ARENA_ID, startTime: start, endTime: end })
        .catch((e) => e);

      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse()).toMatchObject({
        message: expect.any(String),
        suggestedSlots: expect.any(Array),
      });
    });

    it("succeeds when exactly 4 sessions overlap", async () => {
      const created = makeSession();
      sessionRepo.countOverlapping.mockResolvedValue(4);
      sessionRepo.create.mockResolvedValue(created);

      await expect(
        service.createSession({
          arenaId: ARENA_ID,
          startTime: start,
          endTime: end,
        }),
      ).resolves.toEqual(created);
      expect(sessionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ arenaId: ARENA_ID }),
        mockTx,
      );
    });

    it("passes userId to create when provided", async () => {
      sessionRepo.countOverlapping.mockResolvedValue(0);
      sessionRepo.create.mockResolvedValue(makeSession({ userId: 7 }));

      await service.createSession({
        arenaId: ARENA_ID,
        startTime: start,
        endTime: end,
        userId: 7,
      });

      expect(sessionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 7 }),
        mockTx,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // updateSession
  // ---------------------------------------------------------------------------

  describe("updateSession", () => {
    it("throws NotFoundException when session does not exist", async () => {
      sessionRepo.findOne.mockResolvedValue(null);
      await expect(service.updateSession({ id: 99 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it("wraps in a transaction and excludes self from overlap count", async () => {
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
        mockTx,
      );
    });

    it("calls lockOverlappingRows with excludeId", async () => {
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
        42,
      );
    });

    it("acquires advisory xact lock with arenaId from existing session", async () => {
      const existing = makeSession({ id: 42, arenaId: 7 });
      sessionRepo.findOne.mockResolvedValue(existing);
      sessionRepo.countOverlapping.mockResolvedValue(0);
      sessionRepo.update.mockResolvedValue(existing);

      await service.updateSession({ id: 42 });

      expect(db.withAdvisoryXactLock).toHaveBeenCalledWith(
        mockTx,
        AdvisoryLocks.sessionWrite(7),
        expect.any(Function),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findOne / deleteSession
  // ---------------------------------------------------------------------------

  describe("findOne", () => {
    it("throws NotFoundException when not found", async () => {
      sessionRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });

    it("returns session when found", async () => {
      const session = makeSession();
      sessionRepo.findOne.mockResolvedValue(session);
      await expect(service.findOne(1)).resolves.toEqual(session);
    });
  });

  describe("deleteSession", () => {
    it("delegates to sessionRepo.delete", async () => {
      const session = makeSession();
      sessionRepo.findOne.mockResolvedValue(session);
      sessionRepo.delete.mockResolvedValue(session);

      await expect(service.deleteSession(1)).resolves.toBe(true);
      expect(sessionRepo.delete).toHaveBeenCalledWith(1);
    });

    it("throws NotFoundException for non-existent session", async () => {
      sessionRepo.findOne.mockResolvedValue(null);
      await expect(service.deleteSession(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // checkAvailability
  // ---------------------------------------------------------------------------

  describe("checkAvailability", () => {
    const start = makeDate(0);
    const end = makeDate(1);

    it("returns available:true when overlap count < 5", async () => {
      sessionRepo.countOverlapping.mockResolvedValue(4);
      await expect(
        service.checkAvailability(ARENA_ID, start, end),
      ).resolves.toEqual({ available: true });
    });

    it("returns available:false with suggestedSlots when overlap count = 5", async () => {
      sessionRepo.countOverlapping
        .mockResolvedValueOnce(5) // initial check
        .mockResolvedValue(0); // suggestion probes
      sessionRepo.findEndTimesInRange.mockResolvedValue([]);

      const result = await service.checkAvailability(ARENA_ID, start, end);

      expect(result.available).toBe(false);
      expect(result.suggestedSlots).toBeInstanceOf(Array);
    });

    it("passes excludeSessionId to countOverlapping", async () => {
      sessionRepo.countOverlapping.mockResolvedValue(0);

      await service.checkAvailability(ARENA_ID, start, end, 42);

      expect(sessionRepo.countOverlapping).toHaveBeenCalledWith(
        ARENA_ID,
        start,
        end,
        42,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findByArenaAndDateRange
  // ---------------------------------------------------------------------------

  describe("findByArenaAndDateRange", () => {
    it("delegates to sessionRepo", async () => {
      const result = { items: [], total: 0, page: 1, pageSize: 10 };
      sessionRepo.findByArenaAndDateRange.mockResolvedValue(result);

      const dayStart = makeDate(0);
      const dayEnd = makeDate(24);
      await expect(
        service.findByArenaAndDateRange(ARENA_ID, dayStart, dayEnd, 1, 10),
      ).resolves.toEqual(result);
      expect(sessionRepo.findByArenaAndDateRange).toHaveBeenCalledWith(
        ARENA_ID,
        dayStart,
        dayEnd,
        1,
        10,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Boundary: touching sessions must NOT conflict
  // ---------------------------------------------------------------------------

  describe("boundary sessions", () => {
    it("allows session starting exactly when another ends (count=0)", async () => {
      const start = makeDate(1);
      const end = makeDate(2);
      const created = makeSession({ id: 2, startTime: start, endTime: end });
      sessionRepo.countOverlapping.mockResolvedValue(0);
      sessionRepo.create.mockResolvedValue(created);

      await expect(
        service.createSession({
          arenaId: ARENA_ID,
          startTime: start,
          endTime: end,
        }),
      ).resolves.toEqual(created);
    });
  });
});
