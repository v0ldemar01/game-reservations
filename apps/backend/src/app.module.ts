import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { join } from 'node:path';
import type { Request, Response } from 'express';

import { validationSchema } from './config/app.config';
import { DatabaseModule } from './database/database.module';
import { ArenaModule } from './arena/arena.module';
import { SessionModule } from './session/session.module';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { HealthModule } from './health/health.module';
import { RecurringModule } from './recurring/recurring.module';
import { WaitlistModule } from './waitlist/waitlist.module';
import { ExportModule } from './export/export.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { GraphQLHttpExceptionFilter } from './common/filters/graphql-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: true,
      introspection: true,
      context: ({ req, res }: { req: Request; res: Response }) => ({ req, res }),
      formatError: (error) => ({
        message: error.message,
        extensions: error.extensions,
      }),
    }),
    DatabaseModule,
    UserModule,
    AuthModule,
    ArenaModule,
    SessionModule,
    HealthModule,
    RecurringModule,
    WaitlistModule,
    ExportModule,
    AnalyticsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GraphQLHttpExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    },
  ],
})
export class AppModule {}
