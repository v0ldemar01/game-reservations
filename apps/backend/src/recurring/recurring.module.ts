import { Module } from '@nestjs/common';
import { SessionModule } from 'src/session/session.module';

import {
  RECURRING_REPOSITORY,
  RecurringRepository
} from './recurring.repository';
import { RecurringResolver } from './recurring.resolver';
import { RecurringService } from './recurring.service';

@Module({
  exports: [RecurringService],
  imports: [SessionModule],
  providers: [
    RecurringRepository,
    { provide: RECURRING_REPOSITORY, useExisting: RecurringRepository },
    RecurringService,
    RecurringResolver
  ]
})
export class RecurringModule {}
