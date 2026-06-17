import { Test, type TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';

import { DatabaseService } from './database.service';

// Minimal stub — only the methods DatabaseService calls on PrismaService
const prismaMock = {
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  $executeRaw: jest.fn(),
  $queryRaw: jest.fn(),
  $transaction: jest.fn()
};

jest.mock('src/prisma/prisma.service', () => ({
  PrismaService: class {
    $connect = prismaMock.$connect;

    $disconnect = prismaMock.$disconnect;

    $executeRaw = prismaMock.$executeRaw;

    $queryRaw = prismaMock.$queryRaw;

    $transaction = prismaMock.$transaction;
  }
}));

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [DatabaseService]
    }).compile();

    service = module.get(DatabaseService);
  });

  // ---------------------------------------------------------------------------
  // toLockKey / FNV-1a
  // ---------------------------------------------------------------------------

  describe('toLockKey', () => {
    it('is deterministic — same input always produces same key', () => {
      const k1 = service.toLockKey('game-reservations:session-write:1');
      const k2 = service.toLockKey('game-reservations:session-write:1');
      expect(k1).toBe(k2);
    });

    it('different inputs produce different keys', () => {
      const k1 = service.toLockKey('game-reservations:session-write:1');
      const k2 = service.toLockKey('game-reservations:session-write:2');
      expect(k1).not.toBe(k2);
    });

    it('returns a bigint', () => {
      expect(typeof service.toLockKey('test')).toBe('bigint');
    });

    it('result is within signed int64 range', () => {
      const INT64_MIN = -(1n << 63n);
      const INT64_MAX = (1n << 63n) - 1n;
      const key = service.toLockKey('some-lock-key');
      expect(key).toBeGreaterThanOrEqual(INT64_MIN);
      expect(key).toBeLessThanOrEqual(INT64_MAX);
    });

    it('passes through bigint input and converts to signed int64', () => {
      // A value that fits already in signed range
      const k = service.toLockKey(42n);
      expect(k).toBe(42n);
    });

    it('converts unsigned bigint > INT64_MAX to negative signed bigint', () => {
      const unsignedBeyondMax = 1n << 63n; // one past INT64_MAX
      const result = service.toLockKey(unsignedBeyondMax);
      expect(result).toBeLessThan(0n);
    });

    it('empty string produces a deterministic key', () => {
      const k = service.toLockKey('');
      expect(typeof k).toBe('bigint');
      expect(k).toBe(service.toLockKey(''));
    });
  });

  // ---------------------------------------------------------------------------
  // withTransaction
  // ---------------------------------------------------------------------------

  describe('withTransaction', () => {
    it('calls $transaction with ReadCommitted by default', async () => {
      const fn = jest.fn().mockResolvedValue('result');
      prismaMock.$transaction.mockImplementation(
        (f: (tx: unknown) => unknown) => f({})
      );

      await service.withTransaction(fn);

      expect(prismaMock.$transaction).toHaveBeenCalledWith(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 2000,
        timeout: 10_000
      });
    });

    it('uses provided isolationLevel override', async () => {
      const fn = jest.fn().mockResolvedValue('result');
      prismaMock.$transaction.mockImplementation(
        (f: (tx: unknown) => unknown) => f({})
      );

      await service.withTransaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead
      });

      expect(prismaMock.$transaction).toHaveBeenCalledWith(
        fn,
        expect.objectContaining({
          isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead
        })
      );
    });

    it('returns value from transaction callback', async () => {
      prismaMock.$transaction.mockResolvedValue('tx-result');
      const result = await service.withTransaction(jest.fn());
      expect(result).toBe('tx-result');
    });
  });

  // ---------------------------------------------------------------------------
  // withAdvisoryLock
  // ---------------------------------------------------------------------------

  describe('withAdvisoryLock', () => {
    it('acquires lock before fn and releases in finally', async () => {
      const order: string[] = [];
      prismaMock.$executeRaw
        .mockImplementationOnce(() => {
          order.push('acquire');

          return Promise.resolve();
        })
        .mockImplementationOnce(() => {
          order.push('release');

          return Promise.resolve();
        });

      const fn = jest.fn().mockImplementation(() => {
        order.push('fn');

        return Promise.resolve('val');
      });

      const result = await service.withAdvisoryLock('lock-key', fn);

      expect(order).toEqual(['acquire', 'fn', 'release']);
      expect(result).toBe('val');
    });

    it('releases lock even when fn throws', async () => {
      prismaMock.$executeRaw.mockResolvedValue(undefined);
      const fn = jest.fn().mockRejectedValue(new Error('oops'));

      await expect(service.withAdvisoryLock('lock-key', fn)).rejects.toThrow(
        'oops'
      );
      expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(2); // acquire + release
    });
  });

  // ---------------------------------------------------------------------------
  // tryWithAdvisoryLock
  // ---------------------------------------------------------------------------

  describe('tryWithAdvisoryLock', () => {
    it('returns null without calling fn when lock is not acquired', async () => {
      prismaMock.$queryRaw.mockResolvedValue([{ pg_try_advisory_lock: false }]);
      const fn = jest.fn();

      const result = await service.tryWithAdvisoryLock('lock-key', fn);

      expect(result).toBeNull();
      expect(fn).not.toHaveBeenCalled();
      expect(prismaMock.$executeRaw).not.toHaveBeenCalled(); // no unlock
    });

    it('calls fn and releases when lock is acquired', async () => {
      prismaMock.$queryRaw.mockResolvedValue([{ pg_try_advisory_lock: true }]);
      prismaMock.$executeRaw.mockResolvedValue(undefined);
      const fn = jest.fn().mockResolvedValue('done');

      const result = await service.tryWithAdvisoryLock('lock-key', fn);

      expect(fn).toHaveBeenCalled();
      expect(result).toBe('done');
      expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1); // unlock
    });

    it('releases lock even when fn throws', async () => {
      prismaMock.$queryRaw.mockResolvedValue([{ pg_try_advisory_lock: true }]);
      prismaMock.$executeRaw.mockResolvedValue(undefined);
      const fn = jest.fn().mockRejectedValue(new Error('failure'));

      await expect(service.tryWithAdvisoryLock('lock-key', fn)).rejects.toThrow(
        'failure'
      );
      expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1); // still unlocked
    });
  });

  // ---------------------------------------------------------------------------
  // withAdvisoryXactLock
  // ---------------------------------------------------------------------------

  describe('withAdvisoryXactLock', () => {
    it('calls pg_advisory_xact_lock on tx and then calls fn', async () => {
      const mockTx = { $executeRaw: jest.fn().mockResolvedValue(undefined) };
      const fn = jest.fn().mockResolvedValue('xact-result');

      const result = await service.withAdvisoryXactLock(
        mockTx as never,
        'lock-key',
        fn
      );

      expect(mockTx.$executeRaw).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalled();
      expect(result).toBe('xact-result');
    });

    it('does NOT call the outer $executeRaw (no manual unlock for xact lock)', async () => {
      const mockTx = { $executeRaw: jest.fn().mockResolvedValue(undefined) };
      const fn = jest.fn().mockResolvedValue(undefined);

      await service.withAdvisoryXactLock(mockTx as never, 'lock-key', fn);

      expect(prismaMock.$executeRaw).not.toHaveBeenCalled();
    });
  });
});
