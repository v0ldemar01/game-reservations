import {
  MAX_CONCURRENT_SESSIONS,
  MAX_DURATION_SECONDS,
  MAX_SUGGESTIONS,
  MIN_DURATION_SECONDS,
  SUGGESTION_SEARCH_DAYS
} from '@game-reservations/shared';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Session } from '@prisma/client';
import { AdvisoryLocks } from 'src/common/advisory-locks';
import { DatabaseService } from 'src/database/database.service';

import { CreateSessionInput } from './dto/create-session.input';
import { UpdateSessionInput } from './dto/update-session.input';
import { SlotSuggestion } from './models/availability.model';
import { SessionStatus } from './models/session-status.enum';
import { ISessionRepository, SESSION_REPOSITORY } from './session.repository';

@Injectable()
export class SessionService {
  // Interval between periodic slot checkpoints used when no session end-times
  // exist in a time range (e.g. an arena with no bookings for several hours).
  private static readonly CHECKPOINT_INTERVAL_MS = 7_200_000; // 2 hours in ms

  private static readonly MS_PER_DAY = 86_400_000; // 24 hours in ms

  private static readonly MS_PER_SECOND = 1000;

  private static readonly SECONDS_PER_HOUR = 3600;

  private static readonly SECONDS_PER_MINUTE = 60;

  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepo: ISessionRepository,
    private readonly db: DatabaseService
  ) {}

  async checkAvailability(
    arenaId: number,
    startTime: Date,
    endTime: Date,
    excludeSessionId?: number
  ): Promise<{ available: boolean; suggestedSlots?: SlotSuggestion[] }> {
    const peakCount = await this.sessionRepo.countOverlapping(
      arenaId,
      startTime,
      endTime,
      excludeSessionId
    );

    if (peakCount < MAX_CONCURRENT_SESSIONS) {
      return { available: true };
    }

    const durationMs = endTime.getTime() - startTime.getTime();
    const suggestedSlots = await this.findSuggestedSlots(
      arenaId,
      startTime,
      durationMs,
      excludeSessionId
    );

    return { available: false, suggestedSlots };
  }

  async createSession(
    input: Omit<CreateSessionInput, 'arenaId'> & {
      arenaId: number;
      userId?: number;
    }
  ): Promise<Session> {
    this.validateDuration(input.startTime, input.endTime);

    return await this.db.withTransaction(async (tx) => {
      return await this.db.withAdvisoryXactLock(
        tx,
        AdvisoryLocks.sessionWrite(input.arenaId),
        async () => {
          await this.sessionRepo.lockOverlappingRows(
            tx,
            input.arenaId,
            input.startTime,
            input.endTime
          );

          const peakCount = await this.sessionRepo.countOverlapping(
            input.arenaId,
            input.startTime,
            input.endTime,
            undefined,
            tx
          );

          if (peakCount >= MAX_CONCURRENT_SESSIONS) {
            const durationMs =
              input.endTime.getTime() - input.startTime.getTime();
            const suggestedSlots = await this.findSuggestedSlots(
              input.arenaId,
              input.startTime,
              durationMs
            );

            throw new ConflictException({
              message:
                'Arena has reached the maximum of 5 concurrent sessions at this time.',
              suggestedSlots
            });
          }

          return await this.sessionRepo.create(
            {
              arenaId: input.arenaId,
              comment: input.comment,
              endTime: input.endTime,
              playerName: input.playerName,
              startTime: input.startTime,
              status: input.status,
              userId: input.userId
            },
            tx
          );
        }
      );
    });
  }

  async deleteSession(id: number): Promise<boolean> {
    await this.findOne(id);
    await this.sessionRepo.delete(id);

    return true;
  }

  async findByArenaAndDateRange(
    arenaId: number,
    dayStart: Date,
    dayEnd: Date,
    page: number,
    pageSize: number
  ): Promise<{
    items: Session[];
    page: number;
    pageSize: number;
    total: number;
  }> {
    return await this.sessionRepo.findByArenaAndDateRange(
      arenaId,
      dayStart,
      dayEnd,
      page,
      pageSize
    );
  }

  async findOne(id: number): Promise<Session> {
    const session = await this.sessionRepo.findOne(id);

    if (!session) {
      throw new NotFoundException(`Session ${id} not found`);
    }

    return session;
  }

  async updateSession(input: UpdateSessionInput): Promise<Session> {
    const existing = await this.findOne(input.id);

    if (existing.status === SessionStatus.COMPLETED) {
      throw new BadRequestException('Completed sessions cannot be edited.');
    }

    const newStartTime = input.startTime ?? existing.startTime;
    const newEndTime = input.endTime ?? existing.endTime;

    this.validateDuration(newStartTime, newEndTime);

    return await this.db.withTransaction(async (tx) => {
      return await this.db.withAdvisoryXactLock(
        tx,
        AdvisoryLocks.sessionWrite(existing.arenaId),
        async () => {
          await this.sessionRepo.lockOverlappingRows(
            tx,
            existing.arenaId,
            newStartTime,
            newEndTime,
            input.id
          );

          const peakCount = await this.sessionRepo.countOverlapping(
            existing.arenaId,
            newStartTime,
            newEndTime,
            input.id,
            tx
          );

          if (peakCount >= MAX_CONCURRENT_SESSIONS) {
            const durationMs = newEndTime.getTime() - newStartTime.getTime();
            const suggestedSlots = await this.findSuggestedSlots(
              existing.arenaId,
              newStartTime,
              durationMs,
              input.id
            );

            throw new ConflictException({
              message:
                'Arena has reached the maximum of 5 concurrent sessions at this time.',
              suggestedSlots
            });
          }

          return await this.sessionRepo.update(
            input.id,
            {
              comment:
                input.comment === undefined
                  ? (existing.comment ?? undefined)
                  : input.comment,
              endTime: newEndTime,
              playerName:
                input.playerName === undefined
                  ? (existing.playerName ?? undefined)
                  : input.playerName,
              startTime: newStartTime,
              status:
                input.status === undefined ? existing.status : input.status
            },
            tx
          );
        }
      );
    });
  }

  private async findSuggestedSlots(
    arenaId: number,
    from: Date,
    durationMs: number,
    excludeSessionId?: number
  ): Promise<SlotSuggestion[]> {
    const searchEnd = new Date(
      from.getTime() + SUGGESTION_SEARCH_DAYS * SessionService.MS_PER_DAY
    );
    const suggestions: SlotSuggestion[] = [];

    const sessionCandidates = await this.sessionRepo.findEndTimesInRange(
      arenaId,
      from,
      searchEnd,
      excludeSessionId
    );

    const checkpoints: Date[] = [];

    for (
      let t = from.getTime();
      t < searchEnd.getTime();
      t += SessionService.CHECKPOINT_INTERVAL_MS
    ) {
      checkpoints.push(new Date(t));
    }

    const allCandidates = [
      from,
      ...sessionCandidates.map((s) => s.endTime),
      ...checkpoints
    ];
    allCandidates.sort((a, b) => a.getTime() - b.getTime());

    const seen = new Set<number>();
    const candidateTimes = allCandidates.filter((d) => {
      const bucket = Math.floor(d.getTime() / SessionService.MS_PER_SECOND);

      if (seen.has(bucket)) {
        return false;
      }

      seen.add(bucket);

      return true;
    });

    for (const candidateStart of candidateTimes) {
      if (suggestions.length >= MAX_SUGGESTIONS) {
        break;
      }

      if (candidateStart >= searchEnd) {
        break;
      }

      const candidateEnd = new Date(candidateStart.getTime() + durationMs);

      if (candidateEnd > searchEnd) {
        break;
      }

      const count = await this.sessionRepo.countOverlapping(
        arenaId,
        candidateStart,
        candidateEnd,
        excludeSessionId
      );

      if (count < MAX_CONCURRENT_SESSIONS) {
        suggestions.push({ endTime: candidateEnd, startTime: candidateStart });
      }
    }

    return suggestions;
  }

  private validateDuration(startTime: Date, endTime: Date): void {
    const durationSeconds =
      (endTime.getTime() - startTime.getTime()) / SessionService.MS_PER_SECOND;

    if (startTime >= endTime) {
      throw new BadRequestException(
        'Start time must be strictly before end time.'
      );
    }

    if (durationSeconds < MIN_DURATION_SECONDS) {
      throw new BadRequestException(
        `Session duration must be at least ${MIN_DURATION_SECONDS / SessionService.SECONDS_PER_MINUTE} minutes.`
      );
    }

    if (durationSeconds > MAX_DURATION_SECONDS) {
      throw new BadRequestException(
        `Session duration must not exceed ${MAX_DURATION_SECONDS / SessionService.SECONDS_PER_HOUR} hours.`
      );
    }
  }
}
