import { NotFoundException } from '@nestjs/common';
import { Args, ID, Query, Resolver } from '@nestjs/graphql';

import { ArenaService } from './arena.service';
import { ArenaModel } from './models/arena.model';

@Resolver(() => ArenaModel)
export class ArenaResolver {
  constructor(private readonly arenaService: ArenaService) {}

  @Query(() => ArenaModel, { description: 'Get a single arena by id' })
  async arena(@Args('id', { type: () => ID }) id: string): Promise<ArenaModel> {
    const arena = await this.arenaService.findOne(Number(id));

    if (!arena) {
      throw new NotFoundException(`Arena ${id} not found`);
    }

    return arena;
  }

  @Query(() => [ArenaModel], {
    description:
      'List arenas ordered by name. Optionally filter by name substring (case-insensitive). Returns up to 50 results.'
  })
  arenas(
    @Args('search', { description: 'Filter by name substring', nullable: true })
    search?: string
  ): Promise<ArenaModel[]> {
    return this.arenaService.findAll(search);
  }
}
