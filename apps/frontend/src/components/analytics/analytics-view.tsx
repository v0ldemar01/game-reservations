import { useQuery } from '@apollo/client';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';

import { useAuth } from '../../contexts/auth-context.js';
import {
  GET_ARENA_ANALYTICS,
  GET_BUSIEST_ARENAS
} from '../../graphql/queries/arenas.js';
import { ErrorMessage } from '../ui/error-message.js';
import { Spinner } from '../ui/spinner.js';

interface ArenaAnalyticsData {
  arenaAnalytics: {
    dailyUtilization: DailyUtilization[];
    peakHours: Array<{
      count: number;
      hour: number;
    }>;
  };
}

interface BusiestArena {
  arenaId: string;
  arenaName: string;
  sessionCount: number;
  totalBookedMinutes: number;
}

interface BusiestArenasData {
  busiestArenas: BusiestArena[];
}

interface DailyUtilization {
  bookedMinutes: number;
  date: string;
  utilizationPercent: number;
}

interface Properties {
  arenaId: string;
}

const BAR_RADIUS_LG = 3;
const BAR_RADIUS_SM = 2;
const DATE_SLICE_START = 5;
const DEFAULT_PERIOD_DAYS = 30;
const HIGH_UTIL_THRESHOLD = 80;
const HOUR_LABEL_STEP = 4;
const HOURS_PER_DAY = 24;
const MED_UTIL_THRESHOLD = 50;
const MINUTES_PER_HOUR = 60;
const MS_PER_DAY = 86_400_000;
const OPACITY_MIN = 0.2;
const OPACITY_RANGE = 0.8;
const PAD_LENGTH = 2;
const PERCENT_MAX = 100;
const PERIOD_SHORT_DAYS = 7;
const PERIOD_MEDIUM_DAYS = 30;
const PERIOD_LONG_DAYS = 90;

const HOUR_LABELS = Array.from(
  { length: HOURS_PER_DAY },
  (_, index) => `${String(index).padStart(PAD_LENGTH, '0')}:00`
);

const PERIOD_OPTIONS = [
  PERIOD_SHORT_DAYS,
  PERIOD_MEDIUM_DAYS,
  PERIOD_LONG_DAYS
];

export function AnalyticsView({ arenaId }: Readonly<Properties>) {
  const { isAdmin } = useAuth();
  const [period, setPeriod] = useState(DEFAULT_PERIOD_DAYS);
  const { from, to } = useMemo(() => isoRange(period), [period]);

  const { data, error, loading } = useQuery<ArenaAnalyticsData>(
    GET_ARENA_ANALYTICS,
    {
      variables: { arenaId, from, to }
    }
  );

  const { data: busiestData } = useQuery<BusiestArenasData>(
    GET_BUSIEST_ARENAS,
    {
      skip: !isAdmin,
      variables: { from, limit: 10, to }
    }
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <ErrorMessage message="Failed to load analytics." />;
  }

  const daily: DailyUtilization[] = data?.arenaAnalytics.dailyUtilization ?? [];
  const peakHours: Array<{ count: number; hour: number }> =
    data?.arenaAnalytics.peakHours ?? [];
  const maxCount = Math.max(...peakHours.map((h) => h.count), 1);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Period:</span>
        {PERIOD_OPTIONS.map((d) => (
          <button
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              period === d
                ? 'bg-blue-600 text-white'
                : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
            key={d}
            onClick={() => {
              setPeriod(d);
            }}
          >
            {d}d
          </button>
        ))}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">
          Daily Utilization (%)
        </h3>
        {daily.length === 0 ? (
          <p className="text-sm text-gray-400">No sessions in this period.</p>
        ) : (
          <ResponsiveContainer height={200} width="100%">
            <BarChart
              data={daily}
              margin={{ bottom: 0, left: -20, right: 4, top: 4 }}
            >
              <CartesianGrid
                stroke="#f0f0f0"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                interval="preserveStartEnd"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(DATE_SLICE_START)}
              />
              <YAxis
                domain={[0, PERCENT_MAX]}
                tick={{ fontSize: 11 }}
                unit="%"
              />
              <Tooltip
                formatter={(
                  v: number,
                  _: string,
                  props: { payload?: { bookedMinutes?: number } }
                ) => [
                  `${v.toFixed(1)}% (${fmtMinutes(props.payload?.bookedMinutes ?? 0)} booked)`,
                  'Utilization'
                ]}
                labelFormatter={(l: string) => `Date: ${l}`}
              />
              <Bar
                dataKey="utilizationPercent"
                radius={[BAR_RADIUS_LG, BAR_RADIUS_LG, 0, 0]}
              >
                {daily.map((entry) => (
                  <Cell
                    fill={getBarFill(entry.utilizationPercent)}
                    key={entry.date}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-700">
          Bookings by Hour of Day
        </h3>
        <ResponsiveContainer height={160} width="100%">
          <BarChart
            data={peakHours}
            margin={{ bottom: 0, left: -20, right: 4, top: 4 }}
          >
            <CartesianGrid
              stroke="#f0f0f0"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 10 }}
              tickFormatter={(h: number) =>
                h % HOUR_LABEL_STEP === 0 ? HOUR_LABELS[h] : ''
              }
            />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v: number) => [v, 'Sessions']}
              labelFormatter={(h: number) => `Hour: ${HOUR_LABELS[h]}`}
            />
            <Bar dataKey="count" radius={[BAR_RADIUS_SM, BAR_RADIUS_SM, 0, 0]}>
              {peakHours.map((entry) => (
                <Cell
                  fill={`rgba(59,130,246,${OPACITY_MIN + OPACITY_RANGE * (entry.count / maxCount)})`}
                  key={entry.hour}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {isAdmin && busiestData?.busiestArenas && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-gray-700">
            Busiest Arenas (last {period} days)
          </h3>
          <div className="flex flex-col gap-2">
            {busiestData.busiestArenas.map((a) => (
              <div className="flex items-center gap-3" key={a.arenaId}>
                <span className="w-32 truncate text-sm text-gray-700">
                  {a.arenaName}
                </span>
                <div className="flex-1 h-4 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-400"
                    style={{
                      width: `${Math.min(PERCENT_MAX, (a.totalBookedMinutes / (period * HOURS_PER_DAY * MINUTES_PER_HOUR)) * PERCENT_MAX)}%`
                    }}
                  />
                </div>
                <span className="w-24 text-right text-xs text-gray-500">
                  {fmtMinutes(a.totalBookedMinutes)} · {a.sessionCount} sessions
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function fmtMinutes(m: number): string {
  const h = Math.floor(m / MINUTES_PER_HOUR);
  const min = m % MINUTES_PER_HOUR;

  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}

export function getBarFill(utilizationPercent: number): string {
  if (utilizationPercent > HIGH_UTIL_THRESHOLD) {
    return '#ef4444';
  }

  if (utilizationPercent > MED_UTIL_THRESHOLD) {
    return '#f59e0b';
  }

  return '#3b82f6';
}

export function isoRange(daysBack: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - daysBack * MS_PER_DAY);

  return { from: from.toISOString(), to: to.toISOString() };
}
