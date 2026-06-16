import { Module } from "@nestjs/common";
import { ArenaRepository, ARENA_REPOSITORY } from "./arena.repository";
import { ArenaService } from "./arena.service";
import { ArenaResolver } from "./arena.resolver";

@Module({
  providers: [
    ArenaRepository,
    { provide: ARENA_REPOSITORY, useExisting: ArenaRepository },
    ArenaService,
    ArenaResolver,
  ],
  exports: [ArenaService],
})
export class ArenaModule {}
