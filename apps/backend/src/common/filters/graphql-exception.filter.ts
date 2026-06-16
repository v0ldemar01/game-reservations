import { Catch, ArgumentsHost, HttpException } from "@nestjs/common";
import { GqlExceptionFilter, GqlArgumentsHost } from "@nestjs/graphql";
import { GraphQLError } from "graphql";

const HTTP_STATUS_TO_GQL_CODE: Record<number, string> = {
  400: "BAD_USER_INPUT",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  429: "TOO_MANY_REQUESTS",
};

@Catch(HttpException)
export class GraphQLHttpExceptionFilter implements GqlExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): GraphQLError {
    GqlArgumentsHost.create(host);

    const status = exception.getStatus();
    const response = exception.getResponse();

    const message =
      typeof response === "string"
        ? response
        : ((response as Record<string, unknown>).message ?? exception.message);

    const extensions: Record<string, unknown> = {
      statusCode: status,
      code: HTTP_STATUS_TO_GQL_CODE[status] ?? "INTERNAL_SERVER_ERROR",
    };

    if (typeof response === "object") {
      const { message: _msg, ...rest } = response as Record<string, unknown>;
      Object.assign(extensions, rest);
    }

    return new GraphQLError(message as string, { extensions });
  }
}
