import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { ThrottlerModule } from '@nestjs/throttler';
import { type Request, type Response } from 'express';
import path from 'node:path';

import { AnalyticsModule } from './analytics/analytics.module';
import { ArenaModule } from './arena/arena.module';
import { AuthModule } from './auth/auth.module';
import { GraphQLHttpExceptionFilter } from './common/filters/graphql-exception.filter';
import { validationSchema } from './config/app.config';
import { DatabaseModule } from './database/database.module';
import { ExportModule } from './export/export.module';
import { HealthModule } from './health/health.module';
import { RecurringModule } from './recurring/recurring.module';
import { SessionModule } from './session/session.module';
import { UserModule } from './user/user.module';
import { WaitlistModule } from './waitlist/waitlist.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validationSchema }),
    ThrottlerModule.forRoot([{ limit: 100, ttl: 60_000 }]),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      autoSchemaFile: path.join(process.cwd(), 'src/schema.gql'),
      context: ({ req, res }: { req: Request; res: Response }) => ({
        req,
        res
      }),
      driver: ApolloDriver,
      formatError: (error) => ({
        extensions: error.extensions,
        message: error.message
      }),
      introspection: true,
      playground: true,
      sortSchema: true
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
    AnalyticsModule
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GraphQLHttpExceptionFilter
    },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true
      })
    }
  ]
})
export class AppModule {}
