import { MAX_CONCURRENT_SESSIONS } from '@game-reservations/shared';
import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Prisma, RecurringGroup } from '@prisma/client';
import { AdvisoryLocks } from 'src/common/advisory-locks';
import { DatabaseService } from 'src/database/database.service';
import {
  ISessionRepository,
  SESSION_REPOSITORY
} from 'src/session/session.repository';
import { Role } from 'src/user/models/role.enum';

import { CreateRecurringInput } from './dto/create-recurring.input';
import {
  IRecurringRepository,
  RECURRING_REPOSITORY
} from './recurring.repository';

type CreateRecurringResult = {
  createdCount: number;
  group: RecurringGroup;
  skippedCount: number;
};

type Occurrence = { endTime: Date; startTime: Date };

@Injectable()
export class RecurringService {
  private static readonly DAYS_PER_WEEK = 7;

  constructor(
    @Inject(RECURRING_REPOSITORY)
    private readonly recurringRepo: IRecurringRepository,
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepo: ISessionRepository,
    private readonly db: DatabaseService
  ) {}

  async cancelGroup(
    groupId: number,
    userId: number,
    futureOnly: boolean
  ): Promise<true> {
    const group = await this.recurringRepo.findGroupOrThrow(groupId);
    await this.assertCanModifyGroup(group, userId);

    await this.db.withTransaction(async (tx) => {
      await this.recurringRepo.deleteSessions(groupId, futureOnly, tx);
      await this.recurringRepo.deleteGroup(groupId, tx);
    });

    return true;
  }

  async createRecurring(
    input: CreateRecurringInput,
    userId: number
  ): Promise<CreateRecurringResult> {
    const arenaId = Number(input.arenaId);

    const group = await this.recurringRepo.createGroup({
      arenaId,
      comment: input.comment,
      dayOfWeek: input.dayOfWeek,
      endHour: input.endHour,
      endMin: input.endMin,
      playerName: input.playerName,
      startHour: input.startHour,
      startMin: input.startMin,
      userId,
      weeksAhead: input.weeksAhead
    });

    const occurrences = this.computeOccurrences(input);
    let createdCount = 0;
    let skippedCount = 0;

    await this.db.withTransaction(
      async (tx) => {
        await this.db.withAdvisoryXactLock(
          tx,
          AdvisoryLocks.recurringCreate(arenaId),
          async () => {
            for (const { endTime, startTime } of occurrences) {
              const count = await this.sessionRepo.countOverlapping(
                arenaId,
                startTime,
                endTime,
                undefined,
                tx
              );

              if (count >= MAX_CONCURRENT_SESSIONS) {
                skippedCount++;
                continue;
              }

              await this.sessionRepo.create(
                {
                  arenaId,
                  comment: input.comment,
                  endTime,
                  playerName: input.playerName,
                  recurringGroupId: group.id,
                  startTime,
                  userId
                },
                tx
              );
              createdCount++;
            }
          }
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
    );

    return { createdCount, group, skippedCount };
  }

  private async assertCanModifyGroup(
    group: RecurringGroup,
    userId: number
  ): Promise<void> {
    if (group.userId === userId) {
      return;
    }

    const user = await this.db.user.findUnique({ where: { id: userId } });

    if (user?.role !== Role.ADMIN) {
      throw new ForbiddenException();
    }
  }

  private computeOccurrences(input: CreateRecurringInput): Occurrence[] {
    const occurrences: Occurrence[] = [];

    const firstDay = new Date();
    firstDay.setHours(0, 0, 0, 0);
    const daysUntil =
      (input.dayOfWeek - firstDay.getDay() + RecurringService.DAYS_PER_WEEK) %
      RecurringService.DAYS_PER_WEEK;
    // Always start from next week's occurrence — never book the current day
    firstDay.setDate(
      firstDay.getDate() +
        (daysUntil === 0 ? RecurringService.DAYS_PER_WEEK : daysUntil)
    );

    for (let w = 0; w < input.weeksAhead; w++) {
      const day = new Date(firstDay);
      day.setDate(firstDay.getDate() + w * RecurringService.DAYS_PER_WEEK);

      const startTime = new Date(day);
      startTime.setHours(input.startHour, input.startMin, 0, 0);

      const endTime = new Date(day);
      endTime.setHours(input.endHour, input.endMin, 0, 0);

      if (endTime <= startTime) {
        endTime.setDate(endTime.getDate() + 1);
      } // crosses midnight

      occurrences.push({ endTime, startTime });
    }

    return occurrences;
  }
}
