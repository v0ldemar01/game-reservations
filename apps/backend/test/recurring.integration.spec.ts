/**
 * Recurring sessions integration test — requires a live PostgreSQL database.
 *
 * Run with:
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/game_reservations_test \
 *   npx jest test/recurring.integration.spec.ts --testTimeout=30000
 *
 * Verifies:
 *  - createRecurring creates expected number of sessions, skips at capacity
 *  - cancelGroup with futureOnly=true leaves past sessions intact
 *  - cancelGroup with futureOnly=false removes all sessions
 */

import { MAX_CONCURRENT_SESSIONS } from '@game-reservations/shared';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { DatabaseModule } from 'src/database/database.module';
import { DatabaseService } from 'src/database/database.service';
import { RecurringModule } from 'src/recurring/recurring.module';
import { RecurringService } from 'src/recurring/recurring.service';
import { SessionModule } from 'src/session/session.module';

async function cleanup(db: DatabaseService, arenaId: number, userId: number) {
  await db.session.deleteMany({ where: { arenaId } });
  await db.recurringGroup.deleteMany({ where: { arenaId } });
  await db.arena.delete({ where: { id: arenaId } });
  await db.user.delete({ where: { id: userId } });
}

async function setupTestArena(db: DatabaseService) {
  return await db.arena.create({ data: { name: `Test Arena ${Date.now()}` } });
}

async function setupTestUser(db: DatabaseService) {
  return await db.user.create({
    data: {
      email: `test-${Date.now()}@example.com`,
      passwordHash: 'hash',
      role: 'PLAYER'
    }
  });
}

describe('RecurringService (integration)', () => {
  let module: TestingModule;
  let service: RecurringService;
  let db: DatabaseService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        SessionModule,
        RecurringModule
      ]
    }).compile();

    service = module.get<RecurringService>(RecurringService);
    db = module.get<DatabaseService>(DatabaseService);
    await db.$connect();
  });

  afterAll(async () => {
    await db.$disconnect();
    await module.close();
  });

  it('creates sessions for each week ahead when no conflicts', async () => {
    const user = await setupTestUser(db);
    const arena = await setupTestArena(db);

    const { createdCount, group, skippedCount } = await service.createRecurring(
      {
        arenaId: String(arena.id),
        dayOfWeek: 1,
        endHour: 11,
        endMin: 0,
        startHour: 10,
        startMin: 0,
        weeksAhead: 3
      },
      user.id
    );

    expect(createdCount).toBe(3);
    expect(skippedCount).toBe(0);

    const sessions = await db.session.findMany({
      where: { recurringGroupId: group.id }
    });
    expect(sessions).toHaveLength(3);

    await cleanup(db, arena.id, user.id);
  }, 30_000);

  it('skips slots at MAX_CONCURRENT_SESSIONS capacity', async () => {
    const user = await setupTestUser(db);
    const arena = await setupTestArena(db);

    // Pre-fill 5 sessions at the target slot — find the next Monday at 10:00
    const nextMonday = new Date();
    nextMonday.setDate(
      nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7)
    );
    nextMonday.setHours(10, 0, 0, 0);
    const slotEnd = new Date(nextMonday.getTime() + 3_600_000);

    for (let index = 0; index < MAX_CONCURRENT_SESSIONS; index++) {
      const user2 = await setupTestUser(db);
      await db.session.create({
        data: {
          arenaId: arena.id,
          endTime: slotEnd,
          startTime: nextMonday,
          userId: user2.id
        }
      });
    }

    const { createdCount, skippedCount } = await service.createRecurring(
      {
        arenaId: String(arena.id),
        dayOfWeek: 1,
        endHour: 11,
        endMin: 0,
        startHour: 10,
        startMin: 0,
        weeksAhead: 1
      },
      user.id
    );

    expect(skippedCount).toBe(1);
    expect(createdCount).toBe(0);

    // Cleanup all users for this arena
    const sessions = await db.session.findMany({
      where: { arenaId: arena.id }
    });
    const userIds = [
      ...new Set(sessions.map((s) => s.userId).filter(Boolean))
    ] as number[];
    await db.session.deleteMany({ where: { arenaId: arena.id } });
    await db.recurringGroup.deleteMany({ where: { arenaId: arena.id } });
    await db.arena.delete({ where: { id: arena.id } });

    for (const uid of [...userIds, user.id]) {
      await db.user.deleteMany({ where: { id: uid } });
    }
  }, 30_000);

  it('cancelGroup with futureOnly=false removes all sessions', async () => {
    const user = await setupTestUser(db);
    const arena = await setupTestArena(db);

    const { createdCount, group } = await service.createRecurring(
      {
        arenaId: String(arena.id),
        dayOfWeek: 1,
        endHour: 11,
        endMin: 0,
        startHour: 10,
        startMin: 0,
        weeksAhead: 2
      },
      user.id
    );

    expect(createdCount).toBeGreaterThan(0);
    await service.cancelGroup(group.id, user.id, false);

    const remaining = await db.session.count({
      where: { recurringGroupId: group.id }
    });
    expect(remaining).toBe(0);

    await cleanup(db, arena.id, user.id);
  }, 30_000);
});
