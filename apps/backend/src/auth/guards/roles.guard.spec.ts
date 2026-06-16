import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { GqlExecutionContext } from "@nestjs/graphql";
import { Role } from "@prisma/client";
import { RolesGuard } from "./roles.guard";
import { ROLES_KEY } from "../decorators/roles.decorator";

describe("RolesGuard", () => {
  let reflector: jest.Mocked<Reflector>;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as never;

    guard = new RolesGuard(reflector);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function makeExecutionContext(user: { role: Role } | null): ExecutionContext {
    const gqlCtx = { getContext: () => ({ req: { user } }) };
    jest.spyOn(GqlExecutionContext, "create").mockReturnValue(gqlCtx as never);
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
  }

  it("returns true when no roles are required (public route)", () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = makeExecutionContext(null);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("returns true when user has a required role", () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const ctx = makeExecutionContext({ role: Role.ADMIN });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("returns false when user does not have the required role", () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const ctx = makeExecutionContext({ role: Role.PLAYER });
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it("returns true when user has one of multiple required roles", () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN, Role.PLAYER]);
    const ctx = makeExecutionContext({ role: Role.PLAYER });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it("returns falsy when user is null", () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    const ctx = makeExecutionContext(null);
    expect(guard.canActivate(ctx)).toBeFalsy();
  });

  it("calls reflector with ROLES_KEY and both handler + class", () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = makeExecutionContext(null);
    guard.canActivate(ctx);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
  });
});
