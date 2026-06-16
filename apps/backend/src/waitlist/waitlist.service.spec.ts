import { Test, TestingModule } from "@nestjs/testing";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { WaitlistService } from "./waitlist.service";
import { DatabaseService } from "src/database/database.service";
import {
  IWaitlistRepository,
  WAITLIST_REPOSITORY,
} from "./waitlist.repository";
import { AdvisoryLocks } from "src/common/advisory-locks";

function makeEntry(
  overrides: Partial<{
    id: number;
    arenaId: number;
    userId: number;
    startTime: Date;
    endTime: Date;
    notifiedAt: Date | null;
    createdAt: Date;
  }> = {},
) {
  return {
    id: 1,
    arenaId: 1,
    userId: 10,
    startTime: new Date("2024-06-01T10:00:00Z"),
    endTime: new Date("2024-06-01T11:00:00Z"),
    notifiedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("WaitlistService", () => {
  let service: WaitlistService;
  let waitlistRepo: jest.Mocked<IWaitlistRepository>;
  let db: { withTransaction: jest.Mock; withAdvisoryXactLock: jest.Mock };

  const mockTx = {} as Prisma.TransactionClient;

  beforeEach(async () => {
    waitlistRepo = {
      create: jest.fn(),
      findOne: jest.fn(),
      findByUserId: jest.fn(),
      delete: jest.fn(),
      findFirstUnnotified: jest.fn(),
      markNotified: jest.fn(),
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
        WaitlistService,
        { provide: WAITLIST_REPOSITORY, useValue: waitlistRepo },
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();

    service = module.get(WaitlistService);
  });

  // ---------------------------------------------------------------------------
  // join
  // ---------------------------------------------------------------------------

  describe("join", () => {
    it("delegates to waitlistRepo.create with numeric arenaId", async () => {
      const entry = makeEntry();
      waitlistRepo.create.mockResolvedValue(entry);

      const result = await service.join(
        { arenaId: "1", startTime: entry.startTime, endTime: entry.endTime },
        10,
      );

      expect(waitlistRepo.create).toHaveBeenCalledWith({
        arenaId: 1,
        userId: 10,
        startTime: entry.startTime,
        endTime: entry.endTime,
      });
      expect(result).toEqual(entry);
    });
  });

  // ---------------------------------------------------------------------------
  // leave
  // ---------------------------------------------------------------------------

  describe("leave", () => {
    it("throws NotFoundException when entry does not exist", async () => {
      waitlistRepo.findOne.mockResolvedValue(null);
      await expect(service.leave(99, 10)).rejects.toThrow(NotFoundException);
    });

    it("throws ForbiddenException when userId does not match", async () => {
      waitlistRepo.findOne.mockResolvedValue(makeEntry({ userId: 10 }));
      await expect(service.leave(1, 99)).rejects.toThrow(ForbiddenException);
      expect(waitlistRepo.delete).not.toHaveBeenCalled();
    });

    it("deletes entry and returns true for the owner", async () => {
      const entry = makeEntry({ userId: 10 });
      waitlistRepo.findOne.mockResolvedValue(entry);
      waitlistRepo.delete.mockResolvedValue(entry);

      const result = await service.leave(1, 10);

      expect(waitlistRepo.delete).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // myEntries
  // ---------------------------------------------------------------------------

  describe("myEntries", () => {
    it("delegates to waitlistRepo.findByUserId", async () => {
      const entries = [makeEntry()];
      waitlistRepo.findByUserId.mockResolvedValue(entries);

      const result = await service.myEntries(10);

      expect(waitlistRepo.findByUserId).toHaveBeenCalledWith(10);
      expect(result).toEqual(entries);
    });
  });

  // ---------------------------------------------------------------------------
  // notifyFirst
  // ---------------------------------------------------------------------------

  describe("notifyFirst", () => {
    const arenaId = 1;
    const startTime = new Date("2024-06-01T10:00:00Z");
    const endTime = new Date("2024-06-01T11:00:00Z");

    it("acquires advisory xact lock with correct key", async () => {
      waitlistRepo.findFirstUnnotified.mockResolvedValue(null);

      await service.notifyFirst(arenaId, startTime, endTime);

      expect(db.withAdvisoryXactLock).toHaveBeenCalledWith(
        mockTx,
        AdvisoryLocks.waitlistNotify(arenaId, startTime),
        expect.any(Function),
      );
    });

    it("marks the first unnotified entry when one exists", async () => {
      const entry = makeEntry({ id: 42 });
      waitlistRepo.findFirstUnnotified.mockResolvedValue(entry);
      waitlistRepo.markNotified.mockResolvedValue({
        ...entry,
        notifiedAt: new Date(),
      });

      await service.notifyFirst(arenaId, startTime, endTime);

      expect(waitlistRepo.findFirstUnnotified).toHaveBeenCalledWith(
        arenaId,
        startTime,
        endTime,
        mockTx,
      );
      expect(waitlistRepo.markNotified).toHaveBeenCalledWith(42, mockTx);
    });

    it("does nothing when no unnotified entry exists", async () => {
      waitlistRepo.findFirstUnnotified.mockResolvedValue(null);

      await service.notifyFirst(arenaId, startTime, endTime);

      expect(waitlistRepo.markNotified).not.toHaveBeenCalled();
    });

    it("wraps in a transaction", async () => {
      waitlistRepo.findFirstUnnotified.mockResolvedValue(null);

      await service.notifyFirst(arenaId, startTime, endTime);

      expect(db.withTransaction).toHaveBeenCalledTimes(1);
    });
  });
});
