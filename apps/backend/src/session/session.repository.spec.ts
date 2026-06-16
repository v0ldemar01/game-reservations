import { Test, TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { SessionRepository } from "./session.repository";
import { DatabaseService } from "src/database/database.service";
import { SessionStatus } from "./models/session-status.enum";

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
  return {
    id: 1,
    arenaId: 1,
    startTime: makeDate(0),
    endTime: makeDate(1),
    playerName: null,
    comment: null,
    status: SessionStatus.ACTIVE,
    userId: null,
    recurringGroupId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("SessionRepository", () => {
  let repo: SessionRepository;
  let db: {
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
    session: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let mockTx: {
    $queryRaw: jest.Mock;
    session: { create: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    mockTx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      session: { create: jest.fn(), update: jest.fn() },
    };

    db = {
      $transaction: jest.fn(),
      $queryRaw: jest.fn(),
      session: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(makeSession()),
        update: jest.fn().mockResolvedValue(makeSession()),
        delete: jest.fn().mockResolvedValue(makeSession()),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionRepository,
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();

    repo = module.get(SessionRepository);
  });

  // ---------------------------------------------------------------------------
  // findByArenaAndDateRange
  // ---------------------------------------------------------------------------

  describe("findByArenaAndDateRange", () => {
    it("queries with correct overlap filter and pagination", async () => {
      const sessions = [makeSession()];
      db.$transaction.mockResolvedValue([sessions, 7]);

      const result = await repo.findByArenaAndDateRange(
        1,
        makeDate(0),
        makeDate(24),
        2,
        5,
      );

      expect(db.$transaction).toHaveBeenCalledWith([
        expect.anything(), // findMany promise
        expect.anything(), // count promise
      ]);
      expect(result).toEqual({
        items: sessions,
        total: 7,
        page: 2,
        pageSize: 5,
      });
    });

    it("passes skip/take based on page and pageSize", async () => {
      db.$transaction.mockResolvedValue([[], 0]);
      db.session.findMany.mockReturnValue(Promise.resolve([]));
      db.session.count.mockReturnValue(Promise.resolve(0));

      await repo.findByArenaAndDateRange(1, makeDate(0), makeDate(8), 3, 10);

      expect(db.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------

  describe("findOne", () => {
    it("returns null when not found", async () => {
      db.session.findUnique.mockResolvedValue(null);
      await expect(repo.findOne(99)).resolves.toBeNull();
    });

    it("returns session when found", async () => {
      const session = makeSession({ id: 5 });
      db.session.findUnique.mockResolvedValue(session);
      await expect(repo.findOne(5)).resolves.toEqual(session);
      expect(db.session.findUnique).toHaveBeenCalledWith({ where: { id: 5 } });
    });
  });

  // ---------------------------------------------------------------------------
  // countOverlapping
  // ---------------------------------------------------------------------------

  describe("countOverlapping", () => {
    it("queries without excludeId when not provided", async () => {
      db.$queryRaw.mockResolvedValue([{ count: 3n }]);

      const result = await repo.countOverlapping(1, makeDate(0), makeDate(1));

      expect(result).toBe(3);
      expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it("queries with excludeId when provided", async () => {
      db.$queryRaw.mockResolvedValue([{ count: 2n }]);

      const result = await repo.countOverlapping(
        1,
        makeDate(0),
        makeDate(1),
        42,
      );

      expect(result).toBe(2);
      expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it("uses transaction client when tx is provided", async () => {
      mockTx.$queryRaw.mockResolvedValue([{ count: 1n }]);

      const result = await repo.countOverlapping(
        1,
        makeDate(0),
        makeDate(1),
        undefined,
        mockTx as unknown as Prisma.TransactionClient,
      );

      expect(result).toBe(1);
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(db.$queryRaw).not.toHaveBeenCalled();
    });

    it("converts BigInt count to number", async () => {
      db.$queryRaw.mockResolvedValue([{ count: 5n }]);
      await expect(
        repo.countOverlapping(1, makeDate(0), makeDate(1)),
      ).resolves.toBe(5);
      expect(
        typeof (await repo.countOverlapping(1, makeDate(0), makeDate(1))),
      ).toBe("number");
    });
  });

  // ---------------------------------------------------------------------------
  // lockOverlappingRows
  // ---------------------------------------------------------------------------

  describe("lockOverlappingRows", () => {
    it("executes SELECT FOR UPDATE on the tx client", async () => {
      await repo.lockOverlappingRows(
        mockTx as unknown as Prisma.TransactionClient,
        1,
        makeDate(0),
        makeDate(1),
      );
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it("passes excludeId variant when provided", async () => {
      await repo.lockOverlappingRows(
        mockTx as unknown as Prisma.TransactionClient,
        1,
        makeDate(0),
        makeDate(1),
        42,
      );
      expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // findEndTimesInRange
  // ---------------------------------------------------------------------------

  describe("findEndTimesInRange", () => {
    it("returns endTime objects ordered ascending", async () => {
      const rows = [{ endTime: makeDate(1) }, { endTime: makeDate(2) }];
      db.session.findMany.mockResolvedValue(rows as never);

      const result = await repo.findEndTimesInRange(
        1,
        makeDate(0),
        makeDate(10),
      );

      expect(result).toEqual(rows);
      expect(db.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { endTime: true },
          orderBy: { endTime: "asc" },
        }),
      );
    });

    it("adds NOT condition when excludeId is provided", async () => {
      db.session.findMany.mockResolvedValue([]);
      await repo.findEndTimesInRange(1, makeDate(0), makeDate(10), 99);

      expect(db.session.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { not: 99 } }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // create / update / delete
  // ---------------------------------------------------------------------------

  describe("create", () => {
    it("uses tx client when provided", async () => {
      mockTx.session.create.mockResolvedValue(makeSession());
      const data = { arenaId: 1, startTime: makeDate(0), endTime: makeDate(1) };

      await repo.create(data, mockTx as unknown as Prisma.TransactionClient);

      expect(mockTx.session.create).toHaveBeenCalledTimes(1);
      expect(db.session.create).not.toHaveBeenCalled();
    });

    it("uses db client when no tx", async () => {
      const data = { arenaId: 1, startTime: makeDate(0), endTime: makeDate(1) };
      await repo.create(data);
      expect(db.session.create).toHaveBeenCalledTimes(1);
    });
  });

  describe("update", () => {
    it("uses tx client when provided", async () => {
      mockTx.session.update.mockResolvedValue(makeSession());

      await repo.update(
        1,
        { status: SessionStatus.ACTIVE },
        mockTx as unknown as Prisma.TransactionClient,
      );

      expect(mockTx.session.update).toHaveBeenCalledTimes(1);
      expect(db.session.update).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("deletes by id", async () => {
      await repo.delete(5);
      expect(db.session.delete).toHaveBeenCalledWith({ where: { id: 5 } });
    });
  });
});
