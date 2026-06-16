import { Test, TestingModule } from "@nestjs/testing";
import { AnalyticsRepository } from "./analytics.repository";
import { DatabaseService } from "src/database/database.service";
import { SessionStatus } from "src/session/models/session-status.enum";

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
    arenaId: 1,
    startTime: new Date("2024-01-01T10:00:00Z"),
    endTime: new Date("2024-01-01T11:00:00Z"),
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

describe("AnalyticsRepository", () => {
  let repo: AnalyticsRepository;
  let db: {
    session: { findMany: jest.Mock };
    $queryRaw: jest.Mock;
  };

  beforeEach(async () => {
    db = {
      session: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsRepository,
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();

    repo = module.get(AnalyticsRepository);
  });

  // ---------------------------------------------------------------------------
  // findSessionsInRange
  // ---------------------------------------------------------------------------

  describe("findSessionsInRange", () => {
    it("queries with correct overlap filter (start < to AND end > from)", async () => {
      const from = new Date("2024-01-01T00:00:00Z");
      const to = new Date("2024-01-08T00:00:00Z");

      await repo.findSessionsInRange(1, from, to);

      expect(db.session.findMany).toHaveBeenCalledWith({
        where: {
          arenaId: 1,
          startTime: { lt: to },
          endTime: { gt: from },
        },
      });
    });

    it("returns sessions from the query", async () => {
      const sessions = [makeSession(), makeSession({ id: 2 })];
      db.session.findMany.mockResolvedValue(sessions);

      const result = await repo.findSessionsInRange(1, new Date(), new Date());
      expect(result).toEqual(sessions);
    });
  });

  // ---------------------------------------------------------------------------
  // busiestArenas
  // ---------------------------------------------------------------------------

  describe("busiestArenas", () => {
    it("maps BigInt columns to numbers", async () => {
      db.$queryRaw.mockResolvedValue([
        {
          arena_id: 1n,
          arena_name: "Arena A",
          total_minutes: 120n,
          session_count: 10n,
        },
        {
          arena_id: 2n,
          arena_name: "Arena B",
          total_minutes: 60n,
          session_count: 5n,
        },
      ]);

      const result = await repo.busiestArenas(new Date(), new Date(), 5);

      expect(result[0]).toEqual({
        arenaId: 1,
        arenaName: "Arena A",
        totalBookedMinutes: 120,
        sessionCount: 10,
      });
      expect(result[1]).toEqual({
        arenaId: 2,
        arenaName: "Arena B",
        totalBookedMinutes: 60,
        sessionCount: 5,
      });
    });

    it("handles null total_minutes gracefully (returns 0)", async () => {
      db.$queryRaw.mockResolvedValue([
        {
          arena_id: 3n,
          arena_name: "Empty Arena",
          total_minutes: null,
          session_count: 0n,
        },
      ]);

      const result = await repo.busiestArenas(new Date(), new Date(), 5);
      expect(result[0].totalBookedMinutes).toBe(0);
    });

    it("returns JS numbers not BigInts", async () => {
      db.$queryRaw.mockResolvedValue([
        {
          arena_id: 1n,
          arena_name: "A",
          total_minutes: 999n,
          session_count: 9n,
        },
      ]);

      const result = await repo.busiestArenas(new Date(), new Date(), 1);

      expect(typeof result[0].arenaId).toBe("number");
      expect(typeof result[0].totalBookedMinutes).toBe("number");
      expect(typeof result[0].sessionCount).toBe("number");
    });

    it("passes limit to the query", async () => {
      db.$queryRaw.mockResolvedValue([]);
      await repo.busiestArenas(new Date(), new Date(), 10);
      expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });
});
