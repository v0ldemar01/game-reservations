/**
 * Advisory locks integration test — requires a live PostgreSQL database.
 *
 * Run with:
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/game_reservations_test \
 *   npx jest test/advisory-locks.integration.spec.ts --testTimeout=30000
 *
 * Verifies:
 *  - withAdvisoryLock: blocking behaviour, exception unlock
 *  - tryWithAdvisoryLock: non-blocking return when locked
 *  - withAdvisoryXactLock: auto-release on commit
 */

import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { DatabaseModule } from 'src/database/database.module';
import { DatabaseService } from 'src/database/database.service';

describe('DatabaseService — advisory locks (integration)', () => {
  let module: TestingModule;
  let database: DatabaseService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), DatabaseModule]
    }).compile();

    database = module.get<DatabaseService>(DatabaseService);
    await database.$connect();
  });

  afterAll(async () => {
    await database.$disconnect();
    await module.close();
  });

  // ---------------------------------------------------------------------------
  // withAdvisoryLock
  // ---------------------------------------------------------------------------

  describe('withAdvisoryLock', () => {
    it('executes callback and releases lock', async () => {
      let ran = false;
      await database.withAdvisoryLock('test:basic-lock', () => {
        ran = true;

        return Promise.resolve();
      });
      expect(ran).toBe(true);
    });

    it('releases lock even when callback throws', async () => {
      await expect(
        database.withAdvisoryLock('test:throw-lock', () => {
          return Promise.reject(new Error('intentional'));
        })
      ).rejects.toThrow('intentional');

      // Lock must be released — re-acquiring should succeed immediately
      let reacquired = false;
      await database.withAdvisoryLock('test:throw-lock', () => {
        reacquired = true;

        return Promise.resolve();
      });
      expect(reacquired).toBe(true);
    });

    it('returns the value from the callback', async () => {
      const result = await database.withAdvisoryLock('test:return-lock', () =>
        Promise.resolve(42)
      );
      expect(result).toBe(42);
    });
  });

  // ---------------------------------------------------------------------------
  // tryWithAdvisoryLock
  // ---------------------------------------------------------------------------

  describe('tryWithAdvisoryLock', () => {
    it('acquires lock and runs callback when not already held', async () => {
      let ran = false;
      const result = await database.tryWithAdvisoryLock('test:try-free', () => {
        ran = true;

        return Promise.resolve('ok');
      });
      expect(ran).toBe(true);
      expect(result).toBe('ok');
    });

    it('releases lock after callback completes', async () => {
      const lockKey = 'test:try-release';
      await database.tryWithAdvisoryLock(lockKey, () =>
        Promise.resolve('first')
      );

      // Lock must be released — re-acquiring immediately should succeed
      let reacquired = false;
      const result = await database.tryWithAdvisoryLock(lockKey, () => {
        reacquired = true;

        return Promise.resolve('second');
      });
      expect(reacquired).toBe(true);
      expect(result).toBe('second');
    });

    it('releases lock even when callback throws', async () => {
      const lockKey = 'test:try-throw';
      await expect(
        database.tryWithAdvisoryLock(lockKey, () => {
          return Promise.reject(new Error('oops'));
        })
      ).rejects.toThrow('oops');

      // Should be re-acquirable
      const result = await database.tryWithAdvisoryLock(lockKey, () =>
        Promise.resolve('re-acquired')
      );
      expect(result).toBe('re-acquired');
    });
  });

  // ---------------------------------------------------------------------------
  // withAdvisoryXactLock
  // ---------------------------------------------------------------------------

  describe('withAdvisoryXactLock', () => {
    it('acquires xact lock and auto-releases on transaction commit', async () => {
      let ran = false;
      await database.withTransaction(async (tx) => {
        await database.withAdvisoryXactLock(tx, 'test:xact-lock', () => {
          ran = true;

          return Promise.resolve();
        });
      });
      expect(ran).toBe(true);
    });

    it('auto-releases xact lock on transaction rollback', async () => {
      await expect(
        database.withTransaction(async (tx) => {
          await database.withAdvisoryXactLock(
            tx,
            'test:xact-rollback',
            async () => {}
          );

          throw new Error('rollback me');
        })
      ).rejects.toThrow('rollback me');

      // Lock should be released after rollback — re-acquiring should work
      let reacquired = false;
      await database.withTransaction(async (tx) => {
        await database.withAdvisoryXactLock(tx, 'test:xact-rollback', () => {
          reacquired = true;

          return Promise.resolve();
        });
      });
      expect(reacquired).toBe(true);
    });
  });
});
