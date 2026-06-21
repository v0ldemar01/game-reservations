import { type ExecutionContext } from '@nestjs/common';
import { type Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { type ValueOf } from 'src/common/types/types';
import { Role } from 'src/user/models/role.enum';

import { ROLES_KEY } from '../decorators/roles.decorator';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let reflector: jest.Mocked<Reflector>;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn()
    } as never;

    guard = new RolesGuard(reflector);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function makeExecutionContext(
    user: null | { role: ValueOf<typeof Role> }
  ): ExecutionContext {
    const gqlContext = { getContext: () => ({ req: { user } }) };
    jest
      .spyOn(GqlExecutionContext, 'create')
      .mockReturnValue(gqlContext as never);

    return {
      getClass: jest.fn(),
      getHandler: jest.fn()
    } as unknown as ExecutionContext;
  }

  it('returns true when no roles are required (public route)', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = makeExecutionContext(null);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('returns true when user has a required role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const ctx = makeExecutionContext({ role: Role.ADMIN });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('returns false when user does not have the required role', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const ctx = makeExecutionContext({ role: Role.PLAYER });
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('returns true when user has one of multiple required roles', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN, Role.PLAYER]);
    const ctx = makeExecutionContext({ role: Role.PLAYER });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('returns false when user is null', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const ctx = makeExecutionContext(null);
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('calls reflector with ROLES_KEY and both handler + class', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = makeExecutionContext(null);
    guard.canActivate(ctx);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass()
    ]);
  });
});
