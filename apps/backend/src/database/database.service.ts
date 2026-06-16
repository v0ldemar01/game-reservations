import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

export interface TransactionOptions {
  isolationLevel?: Prisma.TransactionIsolationLevel;
  maxWait?: number;
  timeout?: number;
}

@Injectable()
export class DatabaseService extends PrismaService {
  async withTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options: TransactionOptions = {},
  ): Promise<T> {
    return this.$transaction(fn, {
      isolationLevel:
        options.isolationLevel ??
        Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: options.maxWait ?? 2_000,
      timeout: options.timeout ?? 10_000,
    });
  }

  // Session-scoped — waits until acquired, must be released
  async withAdvisoryLock<T>(
    key: string | bigint,
    fn: () => Promise<T>,
  ): Promise<T> {
    const lockKey = this.toLockKey(key);
    await this.$executeRaw`SELECT pg_advisory_lock(${lockKey})`;
    try {
      return await fn();
    } finally {
      await this.$executeRaw`SELECT pg_advisory_unlock(${lockKey})`;
    }
  }

  // Session-scoped — returns null immediately if not acquired (non-blocking)
  async tryWithAdvisoryLock<T>(
    key: string | bigint,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    const lockKey = this.toLockKey(key);
    const [row] = await this.$queryRaw<[{ pg_try_advisory_lock: boolean }]>`
      SELECT pg_try_advisory_lock(${lockKey})
    `;
    if (!row.pg_try_advisory_lock) return null;
    try {
      return await fn();
    } finally {
      await this.$executeRaw`SELECT pg_advisory_unlock(${lockKey})`;
    }
  }

  // Transaction-scoped — released automatically on commit/rollback (no manual unlock)
  async withAdvisoryXactLock<T>(
    tx: Prisma.TransactionClient,
    key: string | bigint,
    fn: () => Promise<T>,
  ): Promise<T> {
    const lockKey = this.toLockKey(key);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;
    return fn();
  }

  toLockKey(key: string | bigint): bigint {
    if (typeof key === "bigint") return this.toSignedInt64(key);
    return this.toSignedInt64(this.fnv1a64(key));
  }

  private fnv1a64(input: string): bigint {
    const prime = 1099511628211n;
    const mask = (1n << 64n) - 1n;
    let hash = 14695981039346656037n;
    for (let i = 0; i < input.length; i++) {
      hash ^= BigInt(input.charCodeAt(i));
      hash = (hash * prime) & mask;
    }
    return hash;
  }

  private toSignedInt64(unsigned: bigint): bigint {
    const int64Max = (1n << 63n) - 1n;
    return unsigned > int64Max ? unsigned - (1n << 64n) : unsigned;
  }
}
