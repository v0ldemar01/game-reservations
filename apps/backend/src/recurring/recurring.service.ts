import { Injectable, Inject, ForbiddenException } from "@nestjs/common";
import { Prisma, RecurringGroup, Role } from "@prisma/client";
import { DatabaseService } from "src/database/database.service";
import { AdvisoryLocks } from "src/common/advisory-locks";
import { MAX_CONCURRENT_SESSIONS } from "@game-reservations/shared";
import { CreateRecurringInput } from "./dto/create-recurring.input";
import {
  IRecurringRepository,
  RECURRING_REPOSITORY,
} from "./recurring.repository";
import {
  ISessionRepository,
  SESSION_REPOSITORY,
} from "src/session/session.repository";

type Occurrence = { startTime: Date; endTime: Date };

type CreateRecurringResult = {
  group: RecurringGroup;
  createdCount: number;
  skippedCount: number;
};

@Injectable()
export class RecurringService {
  constructor(
    @Inject(RECURRING_REPOSITORY)
    private readonly recurringRepo: IRecurringRepository,
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepo: ISessionRepository,
    private readonly db: DatabaseService,
  ) {}

  async createRecurring(
    input: CreateRecurringInput,
    userId: number,
  ): Promise<CreateRecurringResult> {
    const arenaId = Number(input.arenaId);

    const group = await this.recurringRepo.createGroup({
      arenaId,
      userId,
      dayOfWeek: input.dayOfWeek,
      startHour: input.startHour,
      startMin: input.startMin,
      endHour: input.endHour,
      endMin: input.endMin,
      weeksAhead: input.weeksAhead,
      playerName: input.playerName,
      comment: input.comment,
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
            for (const { startTime, endTime } of occurrences) {
              const count = await this.sessionRepo.countOverlapping(
                arenaId,
                startTime,
                endTime,
                undefined,
                tx,
              );

              if (count >= MAX_CONCURRENT_SESSIONS) {
                skippedCount++;
                continue;
              }

              await this.sessionRepo.create(
                {
                  arenaId,
                  userId,
                  recurringGroupId: group.id,
                  startTime,
                  endTime,
                  playerName: input.playerName,
                  comment: input.comment,
                },
                tx,
              );
              createdCount++;
            }
          },
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );

    return { group, createdCount, skippedCount };
  }

  async cancelGroup(
    groupId: number,
    userId: number,
    futureOnly: boolean,
  ): Promise<true> {
    const group = await this.recurringRepo.findGroupOrThrow(groupId);
    await this.assertCanModifyGroup(group, userId);

    await this.db.withTransaction(async (tx) => {
      await this.recurringRepo.deleteSessions(groupId, futureOnly, tx);
      await this.recurringRepo.deleteGroup(groupId, tx);
    });

    return true;
  }

  private async assertCanModifyGroup(
    group: RecurringGroup,
    userId: number,
  ): Promise<void> {
    if (group.userId === userId) return;

    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (user?.role !== Role.ADMIN) throw new ForbiddenException();
  }

  private computeOccurrences(input: CreateRecurringInput): Occurrence[] {
    const occurrences: Occurrence[] = [];

    const firstDay = new Date();
    firstDay.setHours(0, 0, 0, 0);
    const daysUntil = (input.dayOfWeek - firstDay.getDay() + 7) % 7;
    // Always start from next week's occurrence — never book the current day
    firstDay.setDate(firstDay.getDate() + (daysUntil === 0 ? 7 : daysUntil));

    for (let w = 0; w < input.weeksAhead; w++) {
      const day = new Date(firstDay);
      day.setDate(firstDay.getDate() + w * 7);

      const startTime = new Date(day);
      startTime.setHours(input.startHour, input.startMin, 0, 0);

      const endTime = new Date(day);
      endTime.setHours(input.endHour, input.endMin, 0, 0);
      if (endTime <= startTime) endTime.setDate(endTime.getDate() + 1); // crosses midnight

      occurrences.push({ startTime, endTime });
    }

    return occurrences;
  }
}
