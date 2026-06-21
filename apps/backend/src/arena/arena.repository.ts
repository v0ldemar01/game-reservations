import { Injectable } from '@nestjs/common';
import { Arena } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';

export const ARENA_REPOSITORY = Symbol('ARENA_REPOSITORY');
export interface IArenaRepository {
  findAll(search?: string): Promise<Arena[]>;
  findOne(id: number): Promise<Arena | null>;
}
@Injectable()
export class ArenaRepository implements IArenaRepository {
  constructor(private readonly db: DatabaseService) {}

  findAll(search?: string): Promise<Arena[]> {
    return this.db.arena.findMany({
      orderBy: { name: 'asc' },
      take: 50,
      where: search
        ? { name: { contains: search, mode: 'insensitive' } }
        : undefined
    });
  }

  findOne(id: number): Promise<Arena | null> {
    return this.db.arena.findUnique({ where: { id } });
  }
}
