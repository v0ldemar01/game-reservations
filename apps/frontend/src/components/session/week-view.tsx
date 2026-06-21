import { useQuery } from '@apollo/client';
import { DEFAULT_PAGE, MAX_PAGE_SIZE } from '@game-reservations/shared';

import { GET_SESSIONS } from '../../graphql/queries/arenas.js';
import { type Session } from '../../types.js';
import {
  addDaysToDate,
  dayOfMonth,
  durationMinutes,
  instantToPlainDate,
  todayISO,
  weekBounds
} from '../../utils/date.js';

interface Properties {
  arenaId: string;
  onSelectDay: (dateString: string) => void;
  selectedDate: string;
  weekStart: string; // YYYY-MM-DD, always a Monday
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_PER_WEEK = 7;
const HOURS_PER_DAY = 24;
const MAX_CONCURRENT = 5;
const MINUTES_PER_HOUR = 60;
const PERCENT_MAX = 100;

export function WeekView({
  arenaId,
  onSelectDay,
  selectedDate,
  weekStart
}: Readonly<Properties>) {
  const { dayEnd, dayStart } = weekBounds(weekStart);

  const { data } = useQuery<{ sessions: { items: Session[] } }>(GET_SESSIONS, {
    variables: {
      arenaId,
      dayEnd,
      dayStart,
      page: DEFAULT_PAGE,
      pageSize: MAX_PAGE_SIZE
    }
  });

  const sessions = data?.sessions.items ?? [];

  const byDay = new Map<string, Session[]>();

  for (const s of sessions) {
    const key = instantToPlainDate(s.startTime);

    if (!byDay.has(key)) {
      byDay.set(key, []);
    }

    byDay.get(key)?.push(s);
  }

  const today = todayISO();

  return (
    <div className="grid grid-cols-7 gap-2">
      {Array.from({ length: DAYS_PER_WEEK }).map((_, index) => {
        const key = addDaysToDate(weekStart, index);
        const daySessions = byDay.get(key) ?? [];
        const bookedMinutes = daySessions.reduce(
          (accumulator, s) =>
            accumulator + durationMinutes(s.startTime, s.endTime),
          0
        );
        const fillPercent = Math.min(
          PERCENT_MAX,
          (bookedMinutes /
            (MAX_CONCURRENT * HOURS_PER_DAY * MINUTES_PER_HOUR)) *
            PERCENT_MAX
        );
        const isSelected = key === selectedDate;
        const isToday = key === today;

        return (
          <button
            className={`flex flex-col rounded-lg border p-3 text-left transition-colors ${
              isSelected
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            }`}
            key={key}
            onClick={() => {
              onSelectDay(key);
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">
                {DAY_NAMES[index]}
              </span>
              {isToday && (
                <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-xs font-bold text-white">
                  Today
                </span>
              )}
            </div>
            <span
              className={`mt-1 text-lg font-bold ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}
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
              {daySessions.length} session{daySessions.length === 1 ? '' : 's'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
