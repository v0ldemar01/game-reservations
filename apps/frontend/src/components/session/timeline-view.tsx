import { Session } from "../../types.js";
import { formatTime, formatDuration } from "../../utils/date.js";

interface Props {
  sessions: Session[];
}

function assignTracks(sessions: Session[]): Array<Session & { track: number }> {
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  );
  const trackEnds: number[] = [];
  return sorted.map((s) => {
    const start = new Date(s.startTime).getTime();
    const end = new Date(s.endTime).getTime();
    let track = trackEnds.findIndex((t) => t <= start);
    if (track === -1) track = trackEnds.length;
    trackEnds[track] = end;
    return { ...s, track };
  });
}

function timeToPercent(iso: string, dayStart: Date): number {
  const ms = new Date(iso).getTime() - dayStart.getTime();
  return Math.max(0, Math.min(100, (ms / 86_400_000) * 100));
}

export function TimelineView({ sessions }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayStart = today;

  const withTracks = assignTracks(sessions);
  const trackCount = Math.max(
    5,
    Math.max(...withTracks.map((s) => s.track + 1), 1),
  );
  const TRACK_HEIGHT = 52;
  const LABEL_HEIGHT = 24;
  const hours = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];

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
        {hours.map((h) => (
          <div
            key={h}
            className="absolute top-0 border-l border-gray-100"
            style={{
              left: `${(h / 24) * 100}%`,
              height: trackCount * TRACK_HEIGHT,
            }}
          />
        ))}

        {Array.from({ length: trackCount }).map((_, i) => (
          <div
            key={i}
            className={`absolute left-0 right-0 ${i % 2 === 0 ? "bg-gray-50" : "bg-white"}`}
            style={{ top: i * TRACK_HEIGHT, height: TRACK_HEIGHT }}
          />
        ))}

        {withTracks.map((s) => {
          const left = timeToPercent(s.startTime, dayStart);
          const right = timeToPercent(s.endTime, dayStart);
          const width = Math.max(right - left, 0.5);
          const isRecurring = !!(s as any).recurringGroupId;
          return (
            <div
              key={s.id}
              title={`${formatTime(s.startTime)}–${formatTime(s.endTime)} ${s.playerName ?? ""} (${formatDuration(s.startTime, s.endTime)})`}
              className={`absolute flex items-center overflow-hidden rounded px-1 text-xs text-white shadow-sm ${
                isRecurring
                  ? "bg-amber-500 hover:bg-amber-600"
                  : "bg-blue-500 hover:bg-blue-600"
              }`}
              style={{
                left: `${left}%`,
                width: `${width}%`,
                top: s.track * TRACK_HEIGHT + 4,
                height: TRACK_HEIGHT - 8,
              }}
            >
              <span className="truncate font-medium">
                {s.playerName ?? formatTime(s.startTime)}
              </span>
            </div>
          );
        })}

        {hours.map((h) => (
          <div
            key={h}
            className="absolute select-none text-xs text-gray-400"
            style={{
              left: `${(h / 24) * 100}%`,
              top: trackCount * TRACK_HEIGHT + 4,
              transform: "translateX(-50%)",
            }}
          >
            {h === 24 ? "" : `${String(h).padStart(2, "0")}:00`}
          </div>
        ))}
      </div>
    </div>
  );
}
