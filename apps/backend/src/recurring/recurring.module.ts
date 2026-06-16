import { Module } from "@nestjs/common";
import {
  RecurringRepository,
  RECURRING_REPOSITORY,
} from "./recurring.repository";
import { RecurringService } from "./recurring.service";
import { RecurringResolver } from "./recurring.resolver";
import { SessionModule } from "src/session/session.module";

@Module({
  imports: [SessionModule],
  providers: [
    RecurringRepository,
    { provide: RECURRING_REPOSITORY, useExisting: RecurringRepository },
    RecurringService,
    RecurringResolver,
  ],
  exports: [RecurringService],
})
export class RecurringModule {}
