export const AdvisoryLocks = {
  // Serializes concurrent bulk-create loops for recurring sessions per arena.
  recurringCreate: (arenaId: number) =>
    `game-reservations:recurring-create:${arenaId}`,

  // Serializes concurrent session create/update writes per arena.
  // Combined with SELECT FOR UPDATE this prevents phantom-read races even
  // when the arena has no existing sessions (no rows to lock).
  sessionWrite: (arenaId: number) =>
    `game-reservations:session-write:${arenaId}`,

  // Serializes concurrent waitlist notification stamps for the same slot.
  waitlistNotify: (arenaId: number, startTime: Date) =>
    `game-reservations:waitlist-notify:${arenaId}:${startTime.toISOString()}`
} as const;
