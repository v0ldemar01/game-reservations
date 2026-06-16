import { Module } from "@nestjs/common";
import { WaitlistRepository, WAITLIST_REPOSITORY } from "./waitlist.repository";
import { WaitlistService } from "./waitlist.service";
import { WaitlistResolver } from "./waitlist.resolver";

@Module({
  providers: [
    WaitlistRepository,
    { provide: WAITLIST_REPOSITORY, useExisting: WaitlistRepository },
    WaitlistService,
    WaitlistResolver,
  ],
  exports: [WaitlistService],
})
export class WaitlistModule {}
