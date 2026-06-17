import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { type WaitlistEntry } from '@prisma/client';
import { AdvisoryLocks } from 'src/common/advisory-locks';
import { DatabaseService } from 'src/database/database.service';

import { JoinWaitlistInput } from './dto/join-waitlist.input';
import {
  IWaitlistRepository,
  WAITLIST_REPOSITORY
} from './waitlist.repository';

@Injectable()
export class WaitlistService {
  constructor(
    @Inject(WAITLIST_REPOSITORY)
    private readonly waitlistRepo: IWaitlistRepository,
    private readonly db: DatabaseService
  ) {}

  async join(input: JoinWaitlistInput, userId: number): Promise<WaitlistEntry> {
    return await this.waitlistRepo.create({
      arenaId: Number(input.arenaId),
      endTime: input.endTime,
      startTime: input.startTime,
      userId
    });
  }

  async leave(entryId: number, userId: number): Promise<boolean> {
    const entry = await this.waitlistRepo.findOne(entryId);

    if (!entry) {
      throw new NotFoundException('Waitlist entry not found');
    }

    if (entry.userId !== userId) {
      throw new ForbiddenException('Not your waitlist entry');
    }

    await this.waitlistRepo.delete(entryId);

    return true;
  }

  myEntries(userId: number): Promise<WaitlistEntry[]> {
    return this.waitlistRepo.findByUserId(userId);
  }

  // Called by SessionService after a deletion to notify the first waiting user.
  async notifyFirst(
    arenaId: number,
    startTime: Date,
    endTime: Date
  ): Promise<void> {
    await this.db.withTransaction(async (tx) => {
      await this.db.withAdvisoryXactLock(
        tx,
        AdvisoryLocks.waitlistNotify(arenaId, startTime),
        async () => {
          const entry = await this.waitlistRepo.findFirstUnnotified(
            arenaId,
            startTime,
            endTime,
            tx
          );

          if (entry) {
            await this.waitlistRepo.markNotified(entry.id, tx);
          }
        }
      );
    });
  }
}
