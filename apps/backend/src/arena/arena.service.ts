import { Inject, Injectable } from '@nestjs/common';
import { Arena } from '@prisma/client';

import { ARENA_REPOSITORY, IArenaRepository } from './arena.repository';

@Injectable()
export class ArenaService {
  constructor(
    @Inject(ARENA_REPOSITORY) private readonly arenaRepo: IArenaRepository
  ) {}

  findAll(search?: string): Promise<Arena[]> {
    return this.arenaRepo.findAll(search);
  }

  findOne(id: number): Promise<Arena | null> {
    return this.arenaRepo.findOne(id);
  }
}
