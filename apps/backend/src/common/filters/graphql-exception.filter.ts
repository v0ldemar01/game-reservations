/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable sonarjs/no-unused-vars */
import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { GqlArgumentsHost, GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';

const HTTP_STATUS_TO_GQL_CODE: Record<number, string> = {
  400: 'BAD_USER_INPUT',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'TOO_MANY_REQUESTS'
};

@Catch(HttpException)
export class GraphQLHttpExceptionFilter implements GqlExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): GraphQLError {
    GqlArgumentsHost.create(host);

    const status = exception.getStatus();
    const response = exception.getResponse();

    const message =
      typeof response === 'string'
        ? response
        : ((response as Record<string, unknown>).message ?? exception.message);

    const extensions: Record<string, unknown> = {
      code: HTTP_STATUS_TO_GQL_CODE[status] ?? 'INTERNAL_SERVER_ERROR',
      statusCode: status
    };

    if (typeof response === 'object') {
      const { message: _message, ...rest } = response as Record<
        string,
        unknown
      >;

      Object.assign(extensions, rest);
    }

    return new GraphQLError(message as string, { extensions });
  }
}
