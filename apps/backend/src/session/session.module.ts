import { Module } from '@nestjs/common';

import { SESSION_REPOSITORY, SessionRepository } from './session.repository';
import { SessionResolver } from './session.resolver';
import { SessionService } from './session.service';

@Module({
  exports: [SessionService, SESSION_REPOSITORY],
  providers: [
    SessionRepository,
    { provide: SESSION_REPOSITORY, useExisting: SessionRepository },
    SessionService,
    SessionResolver
  ]
})
export class SessionModule {}
