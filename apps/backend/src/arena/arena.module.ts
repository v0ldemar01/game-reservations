import { Module } from '@nestjs/common';

import { ARENA_REPOSITORY, ArenaRepository } from './arena.repository';
import { ArenaResolver } from './arena.resolver';
import { ArenaService } from './arena.service';

@Module({
  exports: [ArenaService],
  providers: [
    ArenaRepository,
    { provide: ARENA_REPOSITORY, useExisting: ArenaRepository },
    ArenaService,
    ArenaResolver
  ]
})
export class ArenaModule {}
