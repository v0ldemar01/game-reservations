import { Injectable, Inject } from "@nestjs/common";
import { Arena } from "@prisma/client";
import { IArenaRepository, ARENA_REPOSITORY } from "./arena.repository";

@Injectable()
export class ArenaService {
  constructor(
    @Inject(ARENA_REPOSITORY) private readonly arenaRepo: IArenaRepository,
  ) {}

  findAll(search?: string): Promise<Arena[]> {
    return this.arenaRepo.findAll(search);
  }

  findOne(id: number): Promise<Arena | null> {
    return this.arenaRepo.findOne(id);
  }
}
