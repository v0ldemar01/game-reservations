import { type Session } from '../../types.js';
import { formatDuration, formatTime } from '../../utils/date.js';

interface Properties {
  sessions: Session[];
}

const BAR_PAD = 8;
const HOURS_PER_DAY = 24;
const HOUR_STEP = 2;
const LABEL_HEIGHT = 24;
const LABEL_OFFSET = 4;
const MIN_TRACKS = 5;
const MIN_WIDTH_PERCENT = 0.5;
const MS_PER_DAY = 86_400_000;
const NOT_FOUND = -1;
const PAD_LENGTH = 2;
const PERCENT_MAX = 100;
const TRACK_HEIGHT = 52;
const TRACK_ALTERNATION = 2;

const TIMELINE_HOURS = Array.from(
  { length: HOURS_PER_DAY / HOUR_STEP + 1 },
  (_, index) => index * HOUR_STEP
);

type RecurringSession = Session & { recurringGroupId?: null | number | string };

export function assignTracks(
  sessions: Session[]
): Array<Session & { track: number }> {
  const sorted = sessions.toSorted(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
  const trackEnds: number[] = [];

  return sorted.map((s) => {
    const start = new Date(s.startTime).getTime();
    const end = new Date(s.endTime).getTime();
    let track = trackEnds.findIndex((t) => t <= start);

    if (track === NOT_FOUND) {
      track = trackEnds.length;
    }

    trackEnds[track] = end;

    return { ...s, track };
  });
}

export function TimelineView({ sessions }: Readonly<Properties>) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayStart = today;

  const withTracks = assignTracks(sessions);
  const trackCount = Math.max(
    MIN_TRACKS,
    Math.max(...withTracks.map((s) => s.track + 1), 1)
  );

  if (sessions.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-400">
        No sessions — timeline is empty for this day
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-white p-4">
      <div
        className="relative w-full"
        style={{ height: trackCount * TRACK_HEIGHT + LABEL_HEIGHT }}
      >
        {TIMELINE_HOURS.map((h) => (
          <div
            className="absolute top-0 border-l border-gray-100"
            key={h}
            style={{
              height: trackCount * TRACK_HEIGHT,
              left: `${(h / HOURS_PER_DAY) * PERCENT_MAX}%`
            }}
          />
        ))}

        {Array.from({ length: trackCount }).map((_, index) => (
          <div
            className={`absolute left-0 right-0 ${index % TRACK_ALTERNATION === 0 ? 'bg-gray-50' : 'bg-white'}`}
            key={index}
            style={{ height: TRACK_HEIGHT, top: index * TRACK_HEIGHT }}
          />
        ))}

        {withTracks.map((s) => {
          const left = timeToPercent(s.startTime, dayStart);
          const right = timeToPercent(s.endTime, dayStart);
          const width = Math.max(right - left, MIN_WIDTH_PERCENT);
          const isRecurring = !!(s as RecurringSession).recurringGroupId;

          return (
            <div
              className={`absolute flex items-center overflow-hidden rounded px-1 text-xs text-white shadow-sm ${
                isRecurring
                  ? 'bg-amber-500 hover:bg-amber-600'
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
              key={s.id}
              style={{
                height: TRACK_HEIGHT - BAR_PAD,
                left: `${left}%`,
                top: s.track * TRACK_HEIGHT + LABEL_OFFSET,
                width: `${width}%`
              }}
              title={`${formatTime(s.startTime)}–${formatTime(s.endTime)} ${s.playerName ?? ''} (${formatDuration(s.startTime, s.endTime)})`}
            >
              <span className="truncate font-medium">
                {s.playerName ?? formatTime(s.startTime)}
              </span>
            </div>
          );
        })}

        {TIMELINE_HOURS.map((h) => (
          <div
            className="absolute select-none text-xs text-gray-400"
            key={h}
            style={{
              left: `${(h / HOURS_PER_DAY) * PERCENT_MAX}%`,
              top: trackCount * TRACK_HEIGHT + LABEL_OFFSET,
              transform: 'translateX(-50%)'
            }}
          >
            {h === HOURS_PER_DAY
              ? ''
              : `${String(h).padStart(PAD_LENGTH, '0')}:00`}
          </div>
        ))}
      </div>
    </div>
  );
}

export function timeToPercent(iso: string, dayStart: Date): number {
  const ms = new Date(iso).getTime() - dayStart.getTime();

  return Math.max(0, Math.min(PERCENT_MAX, (ms / MS_PER_DAY) * PERCENT_MAX));
}
