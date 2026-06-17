import { Module } from '@nestjs/common';

import { WAITLIST_REPOSITORY, WaitlistRepository } from './waitlist.repository';
import { WaitlistResolver } from './waitlist.resolver';
import { WaitlistService } from './waitlist.service';

@Module({
  exports: [WaitlistService],
  providers: [
    WaitlistRepository,
    { provide: WAITLIST_REPOSITORY, useExisting: WaitlistRepository },
    WaitlistService,
    WaitlistResolver
  ]
})
export class WaitlistModule {}
