import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';
import { type Request, type Response } from 'express';

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  getRequestResponse(context: ExecutionContext): {
    req: Request;
    res: Response;
  } {
    const gqlContext = GqlExecutionContext.create(context);
    const ctx = gqlContext.getContext<{ req: Request; res: Response }>();

    return { req: ctx.req, res: ctx.res };
  }
}
