import { Module } from "@nestjs/common";
import { SessionRepository } from "./session.repository";
import { SESSION_REPOSITORY } from "./session.repository";
import { SessionService } from "./session.service";
import { SessionResolver } from "./session.resolver";

@Module({
  providers: [
    SessionRepository,
    { provide: SESSION_REPOSITORY, useExisting: SessionRepository },
    SessionService,
    SessionResolver,
  ],
  exports: [SessionService, SESSION_REPOSITORY],
})
export class SessionModule {}
