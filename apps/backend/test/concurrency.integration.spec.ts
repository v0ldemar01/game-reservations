/**
 * Concurrency integration test — requires a live PostgreSQL database.
 *
 * Run with:
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/game_reservations_test \
 *   npx jest test/concurrency.integration.spec.ts --testTimeout=30000
 *
 * The test verifies the core race-condition guarantee:
 * when N concurrent requests try to create sessions on the same arena at the
 * same overlapping time window, exactly MAX_CONCURRENT (5) should succeed and
 * the rest should receive ConflictException.
 */

import { Test, TestingModule } from "@nestjs/testing";
import { ConflictException } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "src/database/database.module";
import { DatabaseService } from "src/database/database.service";
import { SessionModule } from "src/session/session.module";
import { SessionService } from "src/session/session.service";

const CONCURRENT_REQUESTS = 10;
const MAX_CONCURRENT = 5;

async function setupTestArena(db: DatabaseService): Promise<number> {
  const arena = await db.arena.create({ data: { name: "Test Arena" } });
  return arena.id;
}

async function cleanup(db: DatabaseService, arenaId: number): Promise<void> {
  await db.session.deleteMany({ where: { arenaId } });
  await db.arena.delete({ where: { id: arenaId } });
}

describe("SessionService — concurrency (integration)", () => {
  let module: TestingModule;
  let service: SessionService;
  let db: DatabaseService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DatabaseModule,
        SessionModule,
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    db = module.get<DatabaseService>(DatabaseService);
    await db.$connect();
  });

  afterAll(async () => {
    await db.$disconnect();
    await module.close();
  });

  it(`allows exactly ${MAX_CONCURRENT} of ${CONCURRENT_REQUESTS} concurrent creates`, async () => {
    const arenaId = await setupTestArena(db);

    const startTime = new Date("2099-01-01T10:00:00Z");
    const endTime = new Date("2099-01-01T11:00:00Z");

    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENT_REQUESTS }, () =>
        service.createSession({ arenaId, startTime, endTime }),
      ),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const conflicted = results.filter(
      (r) => r.status === "rejected" && r.reason instanceof ConflictException,
    );
    const otherErrors = results.filter(
      (r) =>
        r.status === "rejected" && !(r.reason instanceof ConflictException),
    );

    expect(otherErrors).toHaveLength(0);
    expect(succeeded).toHaveLength(MAX_CONCURRENT);
    expect(conflicted).toHaveLength(CONCURRENT_REQUESTS - MAX_CONCURRENT);

    // Verify DB state
    const dbCount = await db.session.count({ where: { arenaId } });
    expect(dbCount).toBe(MAX_CONCURRENT);

    await cleanup(db, arenaId);
  }, 30_000);

  it("allows boundary-touching sessions (5 end at T, 5 start at T)", async () => {
    const arenaId = await setupTestArena(db);

    const T = new Date("2099-02-01T12:00:00Z");
    const beforeT = new Date("2099-02-01T11:00:00Z");
    const afterT = new Date("2099-02-01T13:00:00Z");

    // Create 5 sessions ending exactly at T
    await Promise.all(
      Array.from({ length: 5 }, () =>
        service.createSession({ arenaId, startTime: beforeT, endTime: T }),
      ),
    );

    // Now create 5 sessions starting exactly at T — should all succeed (no overlap)
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        service.createSession({ arenaId, startTime: T, endTime: afterT }),
      ),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");

    expect(failed).toHaveLength(0);
    expect(succeeded).toHaveLength(5);

    await cleanup(db, arenaId);
  }, 30_000);
});
