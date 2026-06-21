import { useQuery } from '@apollo/client';
import { DEFAULT_PAGE, MAX_PAGE_SIZE } from '@game-reservations/shared';
import { useState } from 'react';

import { GET_SESSIONS } from '../../graphql/queries/arenas.js';
import { type Arena, type Session } from '../../types.js';
import {
  addDaysToDate,
  formatShortDate,
  formatShortDateWithYear,
  localDayBounds,
  mondayOfWeek,
  todayISO
} from '../../utils/date.js';
import { exportCSV, exportICS } from '../../utils/export.js';
import { AnalyticsView } from '../analytics/analytics-view.js';
import { SessionForm } from '../session/session-form.js';
import { SessionList } from '../session/session-list.js';
import { TimelineView } from '../session/timeline-view.js';
import { WeekView } from '../session/week-view.js';
import { Button } from '../ui/button.js';
import { Modal } from '../ui/modal.js';
import { Spinner } from '../ui/spinner.js';
import { WaitlistPanel } from '../waitlist/waitlist-panel.js';

const DAYS_PER_WEEK = 7;
const WEEK_LAST_DAY_OFFSET = 6;

interface Properties {
  arena: Arena;
}

type ViewMode = 'analytics' | 'list' | 'timeline' | 'waitlist' | 'week';

export function ArenaView({ arena }: Readonly<Properties>) {
  const [date, setDate] = useState<string>(todayISO());
  const [view, setView] = useState<ViewMode>('list');
  const [weekStart, setWeekStart] = useState<string>(() =>
    mondayOfWeek(todayISO())
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<null | Session>(null);
  const [exportError, setExportError] = useState<null | string>(null);

  const { dayEnd, dayStart } = localDayBounds(date);

  const { data: timelineData, loading: timelineLoading } = useQuery<{
    sessions: { items: Session[] };
  }>(GET_SESSIONS, {
    skip: view !== 'timeline',
    variables: {
      arenaId: arena.id,
      dayEnd,
      dayStart,
      page: DEFAULT_PAGE,
      pageSize: MAX_PAGE_SIZE
    }
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
    setView('list');
  };

  const handleExport = async (format: 'csv' | 'ics') => {
    setExportError(null);

    try {
      await (format === 'csv'
        ? exportCSV(arena.id, dayStart, dayEnd)
        : exportICS(arena.id, dayStart, dayEnd));
    } catch {
      setExportError('Export failed. Please try again.');
    }
  };

  const viewOptions: { key: ViewMode; label: string }[] = [
    { key: 'list', label: 'List' },
    { key: 'timeline', label: 'Timeline' },
    { key: 'week', label: 'Week' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'waitlist', label: 'Waitlist' }
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
        <Button className="w-full sm:w-auto" onClick={openCreate}>
          + New Session
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="overflow-x-auto">
            <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 w-max">
              {viewOptions.map(({ key, label }) => (
                <button
                  className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    view === key
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  key={key}
                  onClick={() => {
                    setView(key);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {(view === 'list' || view === 'timeline') && (
            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                onClick={() => {
                  void handleExport('csv');
                }}
              >
                ↓ CSV
              </button>
              <button
                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                onClick={() => {
                  void handleExport('ics');
                }}
              >
                ↓ iCal
              </button>
            </div>
          )}
        </div>

        {(view === 'list' || view === 'timeline') && (
          <div className="flex items-center gap-2">
            <label
              className="text-sm font-medium text-gray-700"
              htmlFor="date-picker"
            >
              Date
            </label>
            <input
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              id="date-picker"
              onChange={(event_) => {
                setDate(event_.target.value);
              }}
              type="date"
              value={date}
            />
          </div>
        )}

        {view === 'week' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
              onClick={() => {
                setWeekStart((w) => addDaysToDate(w, -DAYS_PER_WEEK));
              }}
            >
              ← Prev
            </button>
            <span className="text-sm font-medium text-gray-700">
              {formatShortDate(weekStart)} –{' '}
              {formatShortDateWithYear(
                addDaysToDate(weekStart, WEEK_LAST_DAY_OFFSET)
              )}
            </span>
            <button
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
              onClick={() => {
                setWeekStart((w) => addDaysToDate(w, DAYS_PER_WEEK));
              }}
            >
              Next →
            </button>
            <button
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50"
              onClick={() => {
                setWeekStart(mondayOfWeek(todayISO()));
              }}
            >
              This week
            </button>
          </div>
        )}
      </div>

      {exportError && <p className="text-sm text-red-500">{exportError}</p>}

      {view === 'list' && (
        <SessionList
          arenaId={arena.id}
          dayEnd={dayEnd}
          dayStart={dayStart}
          onEdit={openEdit}
        />
      )}

      {view === 'timeline' &&
        (timelineLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : (
          <TimelineView sessions={timelineData?.sessions.items ?? []} />
        ))}

      {view === 'week' && (
        <WeekView
          arenaId={arena.id}
          onSelectDay={handleDaySelect}
          selectedDate={date}
          weekStart={weekStart}
        />
      )}

      {view === 'analytics' && <AnalyticsView arenaId={arena.id} />}

      {view === 'waitlist' && (
        <div>
          <p className="mb-3 text-sm text-gray-500">
            Your waitlist entries for this arena. You'll be notified when a slot
            becomes available.
          </p>
          <WaitlistPanel arenaId={arena.id} />
        </div>
      )}

      <Modal
        onClose={closeModal}
        open={modalOpen}
        title={editingSession ? 'Edit Session' : 'New Session'}
      >
        <SessionForm
          arenaId={arena.id}
          date={date}
          dayEnd={dayEnd}
          dayStart={dayStart}
          onCancel={closeModal}
          onSuccess={closeModal}
          session={editingSession}
        />
      </Modal>
    </div>
  );
}
