import { useState } from "react";
import { useQuery } from "@apollo/client";
import { Arena, Session } from "../../types.js";
import { SessionList } from "../session/session-list.js";
import { SessionForm } from "../session/session-form.js";
import { TimelineView } from "../session/timeline-view.js";
import { WeekView } from "../session/week-view.js";
import { AnalyticsView } from "../analytics/analytics-view.js";
import { WaitlistPanel } from "../waitlist/waitlist-panel.js";
import { Button } from "../ui/button.js";
import { Modal } from "../ui/modal.js";
import { Spinner } from "../ui/spinner.js";
import { DEFAULT_PAGE, MAX_PAGE_SIZE } from "@game-reservations/shared";
import {
  addDaysToDate,
  formatShortDate,
  formatShortDateWithYear,
  localDayBounds,
  mondayOfWeek,
  todayISO,
} from "../../utils/date.js";
import { exportCSV, exportICS } from "../../utils/export.js";
import { GET_SESSIONS } from "../../graphql/queries/arenas.js";

type ViewMode = "list" | "timeline" | "week" | "analytics" | "waitlist";

interface Props {
  arena: Arena;
}

export function ArenaView({ arena }: Props) {
  const [date, setDate] = useState<string>(todayISO());
  const [view, setView] = useState<ViewMode>("list");
  const [weekStart, setWeekStart] = useState<string>(() =>
    mondayOfWeek(todayISO()),
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const { dayStart, dayEnd } = localDayBounds(date);

  const { data: timelineData, loading: timelineLoading } = useQuery<{
    sessions: { items: Session[] };
  }>(GET_SESSIONS, {
    variables: {
      arenaId: arena.id,
      dayStart,
      dayEnd,
      page: DEFAULT_PAGE,
      pageSize: MAX_PAGE_SIZE,
    },
    skip: view !== "timeline",
  });

  const openCreate = () => {
    setEditingSession(null);
    setModalOpen(true);
  };
  const openEdit = (s: Session) => {
    setEditingSession(s);
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setEditingSession(null);
  };
  const handleDaySelect = (d: string) => {
    setDate(d);
    setView("list");
  };

  const handleExport = async (format: "csv" | "ics") => {
    setExportError(null);
    try {
      if (format === "csv") await exportCSV(arena.id, dayStart, dayEnd);
      else await exportICS(arena.id, dayStart, dayEnd);
    } catch {
      setExportError("Export failed. Please try again.");
    }
  };

  const viewOptions: { key: ViewMode; label: string }[] = [
    { key: "list", label: "List" },
    { key: "timeline", label: "Timeline" },
    { key: "week", label: "Week" },
    { key: "analytics", label: "Analytics" },
    { key: "waitlist", label: "Waitlist" },
  ];

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold text-gray-900 sm:text-2xl">
            {arena.name}
          </h2>
          <p className="text-sm text-gray-500">
            Max 5 concurrent sessions · Open 24/7
          </p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto">
          + New Session
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="overflow-x-auto">
            <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 w-max">
              {viewOptions.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setView(key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    view === key
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {(view === "list" || view === "timeline") && (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button
                onClick={() => handleExport("csv")}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                ↓ CSV
              </button>
              <button
                onClick={() => handleExport("ics")}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                ↓ iCal
              </button>
            </div>
          )}
        </div>

        {(view === "list" || view === "timeline") && (
          <div className="flex items-center gap-2">
            <label
              htmlFor="date-picker"
              className="text-sm font-medium text-gray-700"
            >
              Date
            </label>
            <input
              id="date-picker"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        {view === "week" && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setWeekStart((w) => addDaysToDate(w, -7))}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              ← Prev
            </button>
            <span className="text-sm font-medium text-gray-700">
              {formatShortDate(weekStart)} –{" "}
              {formatShortDateWithYear(addDaysToDate(weekStart, 6))}
            </span>
            <button
              onClick={() => setWeekStart((w) => addDaysToDate(w, 7))}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Next →
            </button>
            <button
              onClick={() => setWeekStart(mondayOfWeek(todayISO()))}
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50"
            >
              This week
            </button>
          </div>
        )}
      </div>

      {exportError && <p className="text-sm text-red-500">{exportError}</p>}

      {view === "list" && (
        <SessionList
          arenaId={arena.id}
          dayStart={dayStart}
          dayEnd={dayEnd}
          onEdit={openEdit}
        />
      )}

      {view === "timeline" &&
        (timelineLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : (
          <TimelineView sessions={timelineData?.sessions.items ?? []} />
        ))}

      {view === "week" && (
        <WeekView
          arenaId={arena.id}
          weekStart={weekStart}
          onSelectDay={handleDaySelect}
          selectedDate={date}
        />
      )}

      {view === "analytics" && <AnalyticsView arenaId={arena.id} />}

      {view === "waitlist" && (
        <div>
          <p className="mb-3 text-sm text-gray-500">
            Your waitlist entries for this arena. You'll be notified when a slot
            becomes available.
          </p>
          <WaitlistPanel arenaId={arena.id} />
        </div>
      )}

      <Modal
        title={editingSession ? "Edit Session" : "New Session"}
        open={modalOpen}
        onClose={closeModal}
      >
        <SessionForm
          arenaId={arena.id}
          date={date}
          dayStart={dayStart}
          dayEnd={dayEnd}
          session={editingSession}
          onSuccess={closeModal}
          onCancel={closeModal}
        />
      </Modal>
    </div>
  );
}
