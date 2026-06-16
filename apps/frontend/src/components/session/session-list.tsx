import { useEffect, useState } from "react";
import { useQuery } from "@apollo/client";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@game-reservations/shared";
import { GET_SESSIONS } from "../../graphql/queries/arenas.js";
import { Session } from "../../types.js";
import { SessionCard } from "./session-card.js";
import { Spinner } from "../ui/spinner.js";
import { ErrorMessage } from "../ui/error-message.js";

interface SessionsPage {
  items: Session[];
  total: number;
  page: number;
  pageSize: number;
}

interface Props {
  arenaId: string;
  dayStart: string;
  dayEnd: string;
  onEdit: (session: Session) => void;
}

export function SessionList({ arenaId, dayStart, dayEnd, onEdit }: Props) {
  const [page, setPage] = useState(DEFAULT_PAGE);

  useEffect(() => {
    setPage(DEFAULT_PAGE);
  }, [dayStart, dayEnd]);

  const { data, loading, error } = useQuery<{ sessions: SessionsPage }>(
    GET_SESSIONS,
    {
      variables: {
        arenaId,
        dayStart,
        dayEnd,
        page,
        pageSize: DEFAULT_PAGE_SIZE,
      },
      fetchPolicy: "cache-and-network",
      skip: !arenaId,
    },
  );

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorMessage message="Failed to load sessions. Please try again." />
    );
  }

  const result = data?.sessions;
  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const totalPages = Math.ceil(total / DEFAULT_PAGE_SIZE);

  if (total === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-200 py-12 text-center text-sm text-gray-400">
        No sessions scheduled for this day.
      </div>
    );
  }

  const refetchVars = {
    arenaId,
    dayStart,
    dayEnd,
    page,
    pageSize: DEFAULT_PAGE_SIZE,
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-500">
        {total} session{total !== 1 ? "s" : ""} — up to 5 can run simultaneously
      </p>

      {items.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          refetchVars={refetchVars}
          onEdit={onEdit}
        />
      ))}

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t pt-3">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 1}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Prev
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className={`h-7 w-7 rounded-md text-xs font-medium transition-colors ${
                  i + 1 === page
                    ? "bg-blue-600 text-white"
                    : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page === totalPages}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
