import { Test, type TestingModule } from '@nestjs/testing';
import { DatabaseService } from 'src/database/database.service';
import { SessionStatus } from 'src/session/models/session-status.enum';

import { AnalyticsRepository } from './analytics.repository';

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
    arenaId: 1,
    comment: null,
    createdAt: now,
    endTime: new Date('2024-01-01T11:00:00Z'),
    id: 1,
    playerName: null,
    recurringGroupId: null,
    startTime: new Date('2024-01-01T10:00:00Z'),
    status: SessionStatus.ACTIVE,
    updatedAt: now,
    userId: null,
    ...overrides
  };
}

describe('AnalyticsRepository', () => {
  let repo: AnalyticsRepository;
  let db: {
    $queryRaw: jest.Mock;
    session: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    db = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      session: { findMany: jest.fn().mockResolvedValue([]) }
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsRepository,
        { provide: DatabaseService, useValue: db }
      ]
    }).compile();

    repo = module.get(AnalyticsRepository);
  });

  // ---------------------------------------------------------------------------
  // findSessionsInRange
  // ---------------------------------------------------------------------------

  describe('findSessionsInRange', () => {
    it('queries with correct overlap filter (start < to AND end > from)', async () => {
      const from = new Date('2024-01-01T00:00:00Z');
      const to = new Date('2024-01-08T00:00:00Z');

      await repo.findSessionsInRange(1, from, to);

      expect(db.session.findMany).toHaveBeenCalledWith({
        where: {
          arenaId: 1,
          endTime: { gt: from },
          startTime: { lt: to }
        }
      });
    });

    it('returns sessions from the query', async () => {
      const sessions = [makeSession(), makeSession({ id: 2 })];
      db.session.findMany.mockResolvedValue(sessions);

      const result = await repo.findSessionsInRange(1, new Date(), new Date());
      expect(result).toEqual(sessions);
    });
  });

  // ---------------------------------------------------------------------------
  // busiestArenas
  // ---------------------------------------------------------------------------

  describe('busiestArenas', () => {
    it('maps BigInt columns to numbers', async () => {
      db.$queryRaw.mockResolvedValue([
        {
          arena_id: 1n,
          arena_name: 'Arena A',
          session_count: 10n,
          total_minutes: 120n
        },
        {
          arena_id: 2n,
          arena_name: 'Arena B',
          session_count: 5n,
          total_minutes: 60n
        }
      ]);

      const result = await repo.busiestArenas(new Date(), new Date(), 5);

      expect(result[0]).toEqual({
        arenaId: 1,
        arenaName: 'Arena A',
        sessionCount: 10,
        totalBookedMinutes: 120
      });
      expect(result[1]).toEqual({
        arenaId: 2,
        arenaName: 'Arena B',
        sessionCount: 5,
        totalBookedMinutes: 60
      });
    });

    it('handles null total_minutes gracefully (returns 0)', async () => {
      db.$queryRaw.mockResolvedValue([
        {
          arena_id: 3n,
          arena_name: 'Empty Arena',
          session_count: 0n,
          total_minutes: null
        }
      ]);

      const result = await repo.busiestArenas(new Date(), new Date(), 5);
      expect(result[0].totalBookedMinutes).toBe(0);
    });

    it('returns JS numbers not BigInts', async () => {
      db.$queryRaw.mockResolvedValue([
        {
          arena_id: 1n,
          arena_name: 'A',
          session_count: 9n,
          total_minutes: 999n
        }
      ]);

      const result = await repo.busiestArenas(new Date(), new Date(), 1);

      expect(typeof result[0].arenaId).toBe('number');
      expect(typeof result[0].totalBookedMinutes).toBe('number');
      expect(typeof result[0].sessionCount).toBe('number');
    });

    it('passes limit to the query', async () => {
      db.$queryRaw.mockResolvedValue([]);
      await repo.busiestArenas(new Date(), new Date(), 10);
      expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });
});
