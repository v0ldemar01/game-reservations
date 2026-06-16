import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ARENA_COUNT = 5;
const DAYS_BACK = 30;
const DAYS_FORWARD = 14;
const BATCH_SIZE = 500;

const PLAYER_NAMES = [
  'Alice', 'Bob', 'Charlie', 'Diana', 'Eve',
  'Frank', 'Grace', 'Henry', 'Iris', 'Jack',
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDurationSeconds(): number {
  return randomInt(5 * 60, 4 * 60 * 60);
}

type SessionRow = {
  arenaId: number;
  startTime: Date;
  endTime: Date;
  playerName: string;
};

async function main(): Promise<void> {
  console.log('🌱 Seeding database...');

  await prisma.session.deleteMany();
  await prisma.arena.deleteMany();

  console.log(`Creating ${ARENA_COUNT} arenas...`);
  const arenaChunks = Array.from({ length: Math.ceil(ARENA_COUNT / BATCH_SIZE) }, (_, i) =>
    Array.from({ length: Math.min(BATCH_SIZE, ARENA_COUNT - i * BATCH_SIZE) }, (__, j) => ({
      name: `Arena ${i * BATCH_SIZE + j + 1}`,
    })),
  );
  for (const chunk of arenaChunks) {
    await prisma.arena.createMany({ data: chunk });
  }

  const arenaIds = (await prisma.arena.findMany({ select: { id: true } })).map((a) => a.id);
  console.log(`✅ Created ${arenaIds.length} arenas`);

  const nowMs = Date.now();
  const startBoundMs = nowMs - DAYS_BACK * 24 * 60 * 60 * 1000;
  const endBoundMs = nowMs + DAYS_FORWARD * 24 * 60 * 60 * 1000;

  let totalSessions = 0;
  let sessionBuffer: SessionRow[] = [];

  console.log('Generating sessions (this may take a minute)...');

  const flushBuffer = async () => {
    if (sessionBuffer.length === 0) return;
    await prisma.session.createMany({ data: sessionBuffer });
    totalSessions += sessionBuffer.length;
    sessionBuffer = [];
    process.stdout.write(`\r  Sessions inserted: ${totalSessions}`);
  };

  for (const arenaId of arenaIds) {
    let cursor = startBoundMs;
    const tracks: number[] = [cursor, cursor, cursor, cursor, cursor];

    while (cursor < endBoundMs) {
      const trackIdx = tracks.indexOf(Math.min(...tracks));
      const sessionStart = tracks[trackIdx] + randomInt(0, 60 * 1000);
      if (sessionStart >= endBoundMs) break;

      const durationMs = randomDurationSeconds() * 1000;
      const sessionEnd = sessionStart + durationMs;
      if (sessionEnd > endBoundMs) break;

      sessionBuffer.push({
        arenaId,
        startTime: new Date(sessionStart),
        endTime: new Date(sessionEnd),
        playerName: PLAYER_NAMES[randomInt(0, PLAYER_NAMES.length - 1)],
      });

      tracks[trackIdx] = sessionEnd;
      cursor = Math.min(...tracks);

      if (sessionBuffer.length >= BATCH_SIZE) {
        await flushBuffer();
      }
    }
  }

  await flushBuffer();

  console.log(`\n✅ Created ${totalSessions} sessions across ${arenaIds.length} arenas`);
  console.log('🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
