import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

export interface TransactionOptions {
  isolationLevel?: Prisma.TransactionIsolationLevel;
  maxWait?: number;
  timeout?: number;
}
@Injectable()
export class DatabaseService extends PrismaService {
  private static readonly DEFAULT_MAX_WAIT_MS = 2000;

  private static readonly DEFAULT_TIMEOUT_MS = 10_000;

  private static readonly FNV_OFFSET_BASIS = 14_695_981_039_346_656_037n;

  private static readonly FNV_PRIME = 1_099_511_628_211n;

  private static readonly INT64_MAX = 9_223_372_036_854_775_807n; // 2^63 - 1

  private static readonly UINT64_MASK = 18_446_744_073_709_551_615n; // 2^64 - 1

  private static readonly UINT64_MODULUS = 18_446_744_073_709_551_616n; // 2^64

  toLockKey(key: bigint | string): bigint {
    if (typeof key === 'bigint') {
      return this.toSignedInt64(key);
    }

    return this.toSignedInt64(this.fnv1a64(key));
  }

  // Session-scoped — returns null immediately if not acquired (non-blocking)
  async tryWithAdvisoryLock<T>(
    key: bigint | string,
    fn: () => Promise<T>
  ): Promise<null | T> {
    const lockKey = this.toLockKey(key);
    const [row] = await this.$queryRaw<[{ pg_try_advisory_lock: boolean }]>`
      SELECT pg_try_advisory_lock(${lockKey})
    `;

    if (!row.pg_try_advisory_lock) {
      return null;
    }

    try {
      return await fn();
    } finally {
      await this.$executeRaw`SELECT pg_advisory_unlock(${lockKey})`;
    }
  }

  // Session-scoped — waits until acquired, must be released
  async withAdvisoryLock<T>(
    key: bigint | string,
    fn: () => Promise<T>
  ): Promise<T> {
    const lockKey = this.toLockKey(key);
    await this.$executeRaw`SELECT pg_advisory_lock(${lockKey})`;

    try {
      return await fn();
    } finally {
      await this.$executeRaw`SELECT pg_advisory_unlock(${lockKey})`;
    }
  }

  // Transaction-scoped — released automatically on commit/rollback (no manual unlock)
  async withAdvisoryXactLock<T>(
    tx: Prisma.TransactionClient,
    key: bigint | string,
    fn: () => Promise<T>
  ): Promise<T> {
    const lockKey = this.toLockKey(key);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

    return await fn();
  }

  async withTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options: TransactionOptions = {}
  ): Promise<T> {
    return await this.$transaction(fn, {
      isolationLevel:
        options.isolationLevel ??
        Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: options.maxWait ?? DatabaseService.DEFAULT_MAX_WAIT_MS,
      timeout: options.timeout ?? DatabaseService.DEFAULT_TIMEOUT_MS
    });
  }

  private fnv1a64(input: string): bigint {
    let hash = DatabaseService.FNV_OFFSET_BASIS;

    for (const char of input) {
      hash ^= BigInt(char.codePointAt(0) ?? 0);
      hash = (hash * DatabaseService.FNV_PRIME) & DatabaseService.UINT64_MASK;
    }

    return hash;
  }

  private toSignedInt64(unsigned: bigint): bigint {
    return unsigned > DatabaseService.INT64_MAX
      ? unsigned - DatabaseService.UINT64_MODULUS
      : unsigned;
  }
}
