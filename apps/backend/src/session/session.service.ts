import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Inject,
} from "@nestjs/common";
import { Session } from "@prisma/client";
import { DatabaseService } from "src/database/database.service";
import { AdvisoryLocks } from "src/common/advisory-locks";
import {
  MAX_CONCURRENT_SESSIONS,
  MIN_DURATION_SECONDS,
  MAX_DURATION_SECONDS,
  SUGGESTION_SEARCH_DAYS,
  MAX_SUGGESTIONS,
} from "@game-reservations/shared";
import { CreateSessionInput } from "./dto/create-session.input";
import { UpdateSessionInput } from "./dto/update-session.input";
import { SlotSuggestion } from "./models/availability.model";
import { ISessionRepository, SESSION_REPOSITORY } from "./session.repository";

// Interval between periodic slot checkpoints used when no session end-times
// exist in a time range (e.g. an arena with no bookings for several hours).
const CHECKPOINT_INTERVAL_MS = 2 * 60 * 60 * 1000; // every 2 hours

@Injectable()
export class SessionService {
  constructor(
    @Inject(SESSION_REPOSITORY)
    private readonly sessionRepo: ISessionRepository,
    private readonly db: DatabaseService,
  ) {}

  async findByArenaAndDateRange(
    arenaId: number,
    dayStart: Date,
    dayEnd: Date,
    page: number,
    pageSize: number,
  ): Promise<{
    items: Session[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    return this.sessionRepo.findByArenaAndDateRange(
      arenaId,
      dayStart,
      dayEnd,
      page,
      pageSize,
    );
  }

  async findOne(id: number): Promise<Session> {
    const session = await this.sessionRepo.findOne(id);
    if (!session) throw new NotFoundException(`Session ${id} not found`);
    return session;
  }

  async checkAvailability(
    arenaId: number,
    startTime: Date,
    endTime: Date,
    excludeSessionId?: number,
  ): Promise<{ available: boolean; suggestedSlots?: SlotSuggestion[] }> {
    const peakCount = await this.sessionRepo.countOverlapping(
      arenaId,
      startTime,
      endTime,
      excludeSessionId,
    );

    if (peakCount < MAX_CONCURRENT_SESSIONS) {
      return { available: true };
    }

    const durationMs = endTime.getTime() - startTime.getTime();
    const suggestedSlots = await this.findSuggestedSlots(
      arenaId,
      startTime,
      durationMs,
      excludeSessionId,
    );
    return { available: false, suggestedSlots };
  }

  async createSession(
    input: Omit<CreateSessionInput, "arenaId"> & {
      arenaId: number;
      userId?: number;
    },
  ): Promise<Session> {
    this.validateDuration(input.startTime, input.endTime);

    return this.db.withTransaction(async (tx) => {
      return this.db.withAdvisoryXactLock(
        tx,
        AdvisoryLocks.sessionWrite(input.arenaId),
        async () => {
          await this.sessionRepo.lockOverlappingRows(
            tx,
            input.arenaId,
            input.startTime,
            input.endTime,
          );

          const peakCount = await this.sessionRepo.countOverlapping(
            input.arenaId,
            input.startTime,
            input.endTime,
            undefined,
            tx,
          );

          if (peakCount >= MAX_CONCURRENT_SESSIONS) {
            const durationMs =
              input.endTime.getTime() - input.startTime.getTime();
            const suggestedSlots = await this.findSuggestedSlots(
              input.arenaId,
              input.startTime,
              durationMs,
            );
            throw new ConflictException({
              message:
                "Arena has reached the maximum of 5 concurrent sessions at this time.",
              suggestedSlots,
            });
          }

          return this.sessionRepo.create(
            {
              arenaId: input.arenaId,
              startTime: input.startTime,
              endTime: input.endTime,
              playerName: input.playerName,
              comment: input.comment,
              status: input.status,
              userId: input.userId,
            },
            tx,
          );
        },
      );
    });
  }

  async updateSession(input: UpdateSessionInput): Promise<Session> {
    const existing = await this.findOne(input.id);

    const newStartTime = input.startTime ?? existing.startTime;
    const newEndTime = input.endTime ?? existing.endTime;

    this.validateDuration(newStartTime, newEndTime);

    return this.db.withTransaction(async (tx) => {
      return this.db.withAdvisoryXactLock(
        tx,
        AdvisoryLocks.sessionWrite(existing.arenaId),
        async () => {
          await this.sessionRepo.lockOverlappingRows(
            tx,
            existing.arenaId,
            newStartTime,
            newEndTime,
            input.id,
          );

          const peakCount = await this.sessionRepo.countOverlapping(
            existing.arenaId,
            newStartTime,
            newEndTime,
            input.id,
            tx,
          );

          if (peakCount >= MAX_CONCURRENT_SESSIONS) {
            const durationMs = newEndTime.getTime() - newStartTime.getTime();
            const suggestedSlots = await this.findSuggestedSlots(
              existing.arenaId,
              newStartTime,
              durationMs,
              input.id,
            );
            throw new ConflictException({
              message:
                "Arena has reached the maximum of 5 concurrent sessions at this time.",
              suggestedSlots,
            });
          }

          return this.sessionRepo.update(
            input.id,
            {
              startTime: newStartTime,
              endTime: newEndTime,
              playerName:
                input.playerName !== undefined
                  ? input.playerName
                  : (existing.playerName ?? undefined),
              comment:
                input.comment !== undefined
                  ? input.comment
                  : (existing.comment ?? undefined),
              status:
                input.status !== undefined ? input.status : existing.status,
            },
            tx,
          );
        },
      );
    });
  }

  async deleteSession(id: number): Promise<boolean> {
    await this.findOne(id);
    await this.sessionRepo.delete(id);
    return true;
  }

  private validateDuration(startTime: Date, endTime: Date): void {
    const durationSeconds = (endTime.getTime() - startTime.getTime()) / 1000;

    if (startTime >= endTime) {
      throw new BadRequestException(
        "Start time must be strictly before end time.",
      );
    }

    if (durationSeconds < MIN_DURATION_SECONDS) {
      throw new BadRequestException(
        `Session duration must be at least ${MIN_DURATION_SECONDS / 60} minutes.`,
      );
    }

    if (durationSeconds > MAX_DURATION_SECONDS) {
      throw new BadRequestException(
        `Session duration must not exceed ${MAX_DURATION_SECONDS / 3600} hours.`,
      );
    }
  }

  private async findSuggestedSlots(
    arenaId: number,
    from: Date,
    durationMs: number,
    excludeSessionId?: number,
  ): Promise<SlotSuggestion[]> {
    const searchEnd = new Date(
      from.getTime() + SUGGESTION_SEARCH_DAYS * 24 * 60 * 60 * 1000,
    );
    const suggestions: SlotSuggestion[] = [];

    const sessionCandidates = await this.sessionRepo.findEndTimesInRange(
      arenaId,
      from,
      searchEnd,
      excludeSessionId,
    );

    const checkpoints: Date[] = [];
    for (
      let t = from.getTime();
      t < searchEnd.getTime();
      t += CHECKPOINT_INTERVAL_MS
    ) {
      checkpoints.push(new Date(t));
    }

    const allCandidates = [
      from,
      ...sessionCandidates.map((s) => s.endTime),
      ...checkpoints,
    ];
    allCandidates.sort((a, b) => a.getTime() - b.getTime());

    const seen = new Set<number>();
    const candidateTimes = allCandidates.filter((d) => {
      const bucket = Math.floor(d.getTime() / 1000);
      if (seen.has(bucket)) return false;
      seen.add(bucket);
      return true;
    });

    for (const candidateStart of candidateTimes) {
      if (suggestions.length >= MAX_SUGGESTIONS) break;
      if (candidateStart >= searchEnd) break;

      const candidateEnd = new Date(candidateStart.getTime() + durationMs);
      if (candidateEnd > searchEnd) break;

      const count = await this.sessionRepo.countOverlapping(
        arenaId,
        candidateStart,
        candidateEnd,
        excludeSessionId,
      );

      if (count < MAX_CONCURRENT_SESSIONS) {
        suggestions.push({ startTime: candidateStart, endTime: candidateEnd });
      }
    }

    return suggestions;
  }
}
