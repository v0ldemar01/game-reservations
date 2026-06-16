import { useQuery } from "@apollo/client";
import { DEFAULT_PAGE, MAX_PAGE_SIZE } from "@game-reservations/shared";
import { GET_SESSIONS } from "../../graphql/queries/arenas.js";
import { Session } from "../../types.js";
import {
  addDaysToDate,
  dayOfMonth,
  durationMinutes,
  instantToPlainDate,
  todayISO,
  weekBounds,
} from "../../utils/date.js";

interface Props {
  arenaId: string;
  weekStart: string; // YYYY-MM-DD, always a Monday
  onSelectDay: (dateStr: string) => void;
  selectedDate: string;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function WeekView({
  arenaId,
  weekStart,
  onSelectDay,
  selectedDate,
}: Props) {
  const { dayStart, dayEnd } = weekBounds(weekStart);

  const { data } = useQuery<{ sessions: { items: Session[] } }>(GET_SESSIONS, {
    variables: {
      arenaId,
      dayStart,
      dayEnd,
      page: DEFAULT_PAGE,
      pageSize: MAX_PAGE_SIZE,
    },
  });

  const sessions = data?.sessions.items ?? [];

  const byDay = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = instantToPlainDate(s.startTime);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(s);
  }

  const today = todayISO();

  return (
    <div className="grid grid-cols-7 gap-2">
      {Array.from({ length: 7 }).map((_, i) => {
        const key = addDaysToDate(weekStart, i);
        const daySessions = byDay.get(key) ?? [];
        const bookedMinutes = daySessions.reduce(
          (acc, s) => acc + durationMinutes(s.startTime, s.endTime),
          0,
        );
        const fillPercent = Math.min(
          100,
          (bookedMinutes / (5 * 24 * 60)) * 100,
        );
        const isSelected = key === selectedDate;
        const isToday = key === today;

        return (
          <button
            key={key}
            onClick={() => onSelectDay(key)}
            className={`flex flex-col rounded-lg border p-3 text-left transition-colors ${
              isSelected
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">
                {DAY_NAMES[i]}
              </span>
              {isToday && (
                <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-xs font-bold text-white">
                  Today
                </span>
              )}
            </div>
            <span
              className={`mt-1 text-lg font-bold ${isSelected ? "text-blue-700" : "text-gray-900"}`}
            >
              {dayOfMonth(key)}
            </span>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-blue-400 transition-all"
                style={{ width: `${fillPercent}%` }}
              />
            </div>
            <span className="mt-1 text-xs text-gray-400">
              {daySessions.length} session{daySessions.length !== 1 ? "s" : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
