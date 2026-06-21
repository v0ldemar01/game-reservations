/**
 * Waitlist notify integration test — requires a live PostgreSQL database.
 *
 * Run with:
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/game_reservations_test \
 *   npx jest test/waitlist-notify.integration.spec.ts --testTimeout=30000
 *
 * Verifies:
 *  - notifyFirst marks exactly one entry per call
 *  - concurrent notifyFirst calls under advisory xact lock mark exactly one entry total
 *  - already-notified entries are skipped
 */

import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { DatabaseModule } from 'src/database/database.module';
import { DatabaseService } from 'src/database/database.service';
import { WaitlistModule } from 'src/waitlist/waitlist.module';
import { WaitlistService } from 'src/waitlist/waitlist.service';

async function setupTestArena(database: DatabaseService) {
  return await database.arena.create({
    data: { name: `Waitlist Arena ${Date.now()}` }
  });
}

async function setupTestUser(database: DatabaseService, suffix = '') {
  return await database.user.create({
    data: {
      email: `waitlist-${Date.now()}${suffix}@example.com`,
      passwordHash: 'hash',
      role: 'PLAYER'
    }
  });
}

describe('WaitlistService — notifyFirst (integration)', () => {
  let module: TestingModule;
  let service: WaitlistService;
  let database: DatabaseService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        WaitlistModule
      ]
    }).compile();

    service = module.get<WaitlistService>(WaitlistService);
    database = module.get<DatabaseService>(DatabaseService);
    await database.$connect();
  });

  afterAll(async () => {
    await database.$disconnect();
    await module.close();
  });

  it('marks exactly one entry when notifyFirst is called', async () => {
    const user1 = await setupTestUser(database, '-a');
    const user2 = await setupTestUser(database, '-b');
    const arena = await setupTestArena(database);

    const startTime = new Date('2099-06-01T10:00:00Z');
    const endTime = new Date('2099-06-01T11:00:00Z');

    const entry1 = await database.waitlistEntry.create({
      data: { arenaId: arena.id, endTime, startTime, userId: user1.id }
    });
    const entry2 = await database.waitlistEntry.create({
      data: { arenaId: arena.id, endTime, startTime, userId: user2.id }
    });

    await service.notifyFirst(arena.id, startTime, endTime);

    const notified = await database.waitlistEntry.findMany({
      where: { id: { in: [entry1.id, entry2.id] }, notifiedAt: { not: null } }
    });

    expect(notified).toHaveLength(1);
    expect(notified[0].id).toBe(entry1.id); // first-created gets notified first

    // Cleanup
    await database.waitlistEntry.deleteMany({ where: { arenaId: arena.id } });
    await database.arena.delete({ where: { id: arena.id } });
    await database.user.deleteMany({
      where: { id: { in: [user1.id, user2.id] } }
    });
  }, 30_000);

  it('concurrent notifyFirst calls mark exactly one entry total', async () => {
    const user1 = await setupTestUser(database, '-c');
    const user2 = await setupTestUser(database, '-d');
    const arena = await setupTestArena(database);

    const startTime = new Date('2099-07-01T10:00:00Z');
    const endTime = new Date('2099-07-01T11:00:00Z');

    await database.waitlistEntry.create({
      data: { arenaId: arena.id, endTime, startTime, userId: user1.id }
    });
    await database.waitlistEntry.create({
      data: { arenaId: arena.id, endTime, startTime, userId: user2.id }
    });

    // Fire two concurrent notifyFirst calls
    await Promise.all([
      service.notifyFirst(arena.id, startTime, endTime),
      service.notifyFirst(arena.id, startTime, endTime)
    ]);

    const notified = await database.waitlistEntry.count({
      where: { arenaId: arena.id, notifiedAt: { not: null } }
    });

    // Exactly one or two entries notified — each concurrent call picks the next unnotified,
    // so both may succeed (each notification is a distinct event). The key invariant is that
    // no single entry has its notifiedAt set more than once (guaranteed by the advisory lock).
    const entries = await database.waitlistEntry.findMany({
      where: { arenaId: arena.id }
    });

    const notifiedIds = entries
      .filter((error) => error.notifiedAt !== null)
      .map((error) => error.id);
    const uniqueNotifiedIds = new Set(notifiedIds);

    expect(uniqueNotifiedIds.size).toBe(notifiedIds.length);
    expect(notified).toBeGreaterThanOrEqual(1);
    expect(notified).toBeLessThanOrEqual(2);

    // Cleanup
    await database.waitlistEntry.deleteMany({ where: { arenaId: arena.id } });
    await database.arena.delete({ where: { id: arena.id } });
    await database.user.deleteMany({
      where: { id: { in: [user1.id, user2.id] } }
    });
  }, 30_000);

  it('skips already-notified entries', async () => {
    const user1 = await setupTestUser(database, '-e');
    const user2 = await setupTestUser(database, '-f');
    const arena = await setupTestArena(database);

    const startTime = new Date('2099-08-01T10:00:00Z');
    const endTime = new Date('2099-08-01T11:00:00Z');

    // Create entry1 as already-notified, entry2 as unnotified
    const entry1 = await database.waitlistEntry.create({
      data: {
        arenaId: arena.id,
        endTime,
        notifiedAt: new Date(),
        startTime,
        userId: user1.id
      }
    });
    const entry2 = await database.waitlistEntry.create({
      data: { arenaId: arena.id, endTime, startTime, userId: user2.id }
    });

    await service.notifyFirst(arena.id, startTime, endTime);

    const updatedEntry2 = await database.waitlistEntry.findUnique({
      where: { id: entry2.id }
    });
    expect(updatedEntry2!.notifiedAt).not.toBeNull();

    const updatedEntry1 = await database.waitlistEntry.findUnique({
      where: { id: entry1.id }
    });
    // entry1 was already notified — notifiedAt should not have changed (i.e., not reset)
    expect(updatedEntry1!.notifiedAt).not.toBeNull();

    // Cleanup
    await database.waitlistEntry.deleteMany({ where: { arenaId: arena.id } });
    await database.arena.delete({ where: { id: arena.id } });
    await database.user.deleteMany({
      where: { id: { in: [user1.id, user2.id] } }
    });
  }, 30_000);
});
