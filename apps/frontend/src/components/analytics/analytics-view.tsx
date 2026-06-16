import { useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  GET_ARENA_ANALYTICS,
  GET_BUSIEST_ARENAS,
} from "../../graphql/queries/arenas.js";
import { useAuth } from "../../contexts/auth-context.js";
import { Spinner } from "../ui/spinner.js";
import { ErrorMessage } from "../ui/error-message.js";

interface Props {
  arenaId: string;
}

function isoRange(daysBack: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - daysBack * 86_400_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}

const HOUR_LABELS = Array.from(
  { length: 24 },
  (_, i) => `${String(i).padStart(2, "0")}:00`,
);

export function AnalyticsView({ arenaId }: Props) {
  const { isAdmin } = useAuth();
  const [period, setPeriod] = useState(30);
  const { from, to } = useMemo(() => isoRange(period), [period]);

  const { data, loading, error } = useQuery(GET_ARENA_ANALYTICS, {
    variables: { arenaId, from, to },
  });

  const { data: busiestData } = useQuery(GET_BUSIEST_ARENAS, {
    variables: { from, to, limit: 10 },
    skip: !isAdmin,
  });

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  if (error) return <ErrorMessage message="Failed to load analytics." />;

  const daily: Array<{
    date: string;
    utilizationPercent: number;
    bookedMinutes: number;
  }> = data?.arenaAnalytics?.dailyUtilization ?? [];

  const peakHours: Array<{ hour: number; count: number }> =
    data?.arenaAnalytics?.peakHours ?? [];

  const maxCount = Math.max(...peakHours.map((h) => h.count), 1);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Period:</span>
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setPeriod(d)}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              period === d
                ? "bg-blue-600 text-white"
                : "border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
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
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={daily}
              margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f0f0f0"
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(5)}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
              <Tooltip
                formatter={(
                  v: number,
                  _: string,
                  props: { payload?: { bookedMinutes?: number } },
                ) => [
                  `${v.toFixed(1)}% (${fmtMinutes(props.payload?.bookedMinutes ?? 0)} booked)`,
                  "Utilization",
                ]}
                labelFormatter={(l: string) => `Date: ${l}`}
              />
              <Bar dataKey="utilizationPercent" radius={[3, 3, 0, 0]}>
                {daily.map((entry) => (
                  <Cell
                    key={entry.date}
                    fill={
                      entry.utilizationPercent > 80
                        ? "#ef4444"
                        : entry.utilizationPercent > 50
                          ? "#f59e0b"
                          : "#3b82f6"
                    }
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
        <ResponsiveContainer width="100%" height={160}>
          <BarChart
            data={peakHours}
            margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#f0f0f0"
            />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 10 }}
              tickFormatter={(h: number) => (h % 4 === 0 ? HOUR_LABELS[h] : "")}
            />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              formatter={(v: number) => [v, "Sessions"]}
              labelFormatter={(h: number) => `Hour: ${HOUR_LABELS[h]}`}
            />
            <Bar dataKey="count" radius={[2, 2, 0, 0]}>
              {peakHours.map((entry) => (
                <Cell
                  key={entry.hour}
                  fill={`rgba(59,130,246,${0.2 + 0.8 * (entry.count / maxCount)})`}
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
            {busiestData.busiestArenas.map(
              (a: {
                arenaId: string;
                arenaName: string;
                totalBookedMinutes: number;
                sessionCount: number;
              }) => (
                <div key={a.arenaId} className="flex items-center gap-3">
                  <span className="w-32 truncate text-sm text-gray-700">
                    {a.arenaName}
                  </span>
                  <div className="flex-1 h-4 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-400"
                      style={{
                        width: `${Math.min(100, (a.totalBookedMinutes / (period * 24 * 60)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="w-24 text-right text-xs text-gray-500">
                    {fmtMinutes(a.totalBookedMinutes)} · {a.sessionCount}{" "}
                    sessions
                  </span>
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
