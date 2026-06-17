import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ValueOf } from 'src/common/types/types';
import { Role } from 'src/user/models/role.enum';

import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<
      undefined | ValueOf<typeof Role>[]
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!required) {
      return true;
    }

    const ctx = GqlExecutionContext.create(context);
    const { user } = ctx.getContext<{
      req: { user?: { role: ValueOf<typeof Role> } };
    }>().req;

    return user !== undefined && required.includes(user.role);
  }
}
