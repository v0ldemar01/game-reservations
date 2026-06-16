import { useState } from "react";
import { useMutation } from "@apollo/client";
import { toast } from "sonner";
import { Session } from "../../types.js";
import {
  formatTime,
  formatDuration,
  formatDateTime,
} from "../../utils/date.js";
import { DELETE_SESSION } from "../../graphql/mutations/sessions.js";
import { CANCEL_RECURRING_GROUP } from "../../graphql/mutations/recurring.js";
import { GET_SESSIONS } from "../../graphql/queries/arenas.js";
import { Button } from "../ui/button.js";
import { Modal } from "../ui/modal.js";

interface RefetchVars {
  arenaId: string;
  dayStart: string;
  dayEnd: string;
  page: number;
  pageSize: number;
}

interface Props {
  session: Session;
  refetchVars: RefetchVars;
  onEdit: (session: Session) => void;
}

export function SessionCard({ session, refetchVars, onEdit }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [deleteSession, { loading: deleteLoading }] = useMutation(
    DELETE_SESSION,
    {
      refetchQueries: [{ query: GET_SESSIONS, variables: refetchVars }],
    },
  );

  const [cancelGroup, { loading: cancelLoading }] = useMutation(
    CANCEL_RECURRING_GROUP,
    {
      refetchQueries: [{ query: GET_SESSIONS, variables: refetchVars }],
    },
  );

  const loading = deleteLoading || cancelLoading;

  const handleDeleteOne = async () => {
    setConfirmOpen(false);
    try {
      await deleteSession({ variables: { id: session.id } });
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to cancel session.",
      );
    }
  };

  const handleCancelAll = async () => {
    setConfirmOpen(false);
    try {
      await cancelGroup({
        variables: {
          groupId: (session as any).recurringGroupId,
          futureOnly: false,
        },
      });
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to cancel recurring group.",
      );
    }
  };

  const handleCancelFuture = async () => {
    setConfirmOpen(false);
    try {
      await cancelGroup({
        variables: {
          groupId: (session as any).recurringGroupId,
          futureOnly: true,
        },
      });
    } catch (err: unknown) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to cancel future sessions.",
      );
    }
  };

  const crossesMidnight =
    new Date(session.startTime).toDateString() !==
    new Date(session.endTime).toDateString();

  const isRecurring = !!(session as any).recurringGroupId;

  return (
    <>
      <article className="flex flex-col gap-3 rounded-lg border bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-gray-900">
              {formatTime(session.startTime)} – {formatTime(session.endTime)}
              {crossesMidnight && (
                <span className="ml-1 text-xs text-gray-400">(next day)</span>
              )}
            </span>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
              {formatDuration(session.startTime, session.endTime)}
            </span>
            {session.status === "COMPLETED" && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                ✓ Completed
              </span>
            )}
            {isRecurring && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                ↻ Recurring
              </span>
            )}
          </div>

          {session.playerName && (
            <p className="truncate text-sm text-gray-600">
              <span className="font-medium">Player:</span> {session.playerName}
            </p>
          )}

          {session.comment && (
            <p className="line-clamp-2 text-sm italic text-gray-500">
              {session.comment}
            </p>
          )}

          <p className="text-xs text-gray-400">
            Created {formatDateTime(session.createdAt)}
          </p>
        </div>

        <div className="flex shrink-0 gap-2 sm:ml-4">
          <Button variant="secondary" onClick={() => onEdit(session)}>
            Edit
          </Button>
          <Button
            variant="danger"
            loading={loading}
            onClick={() => setConfirmOpen(true)}
          >
            Cancel
          </Button>
        </div>
      </article>

      <Modal
        title="Cancel Session"
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
      >
        <div className="flex flex-col gap-5">
          <p className="text-sm text-gray-700">
            Are you sure you want to cancel this session?
            {session.playerName && (
              <>
                {" "}
                It is booked for{" "}
                <span className="font-medium">{session.playerName}</span>.
              </>
            )}
          </p>

          {isRecurring && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              This is part of a recurring series. You can cancel just this
              occurrence or the entire group.
            </div>
          )}

          <div className="flex flex-col gap-2 border-t pt-4">
            {isRecurring ? (
              <>
                <Button
                  variant="danger"
                  loading={loading}
                  onClick={handleDeleteOne}
                >
                  Cancel this session only
                </Button>
                <Button
                  variant="danger"
                  loading={loading}
                  onClick={handleCancelFuture}
                >
                  Cancel this + all future occurrences
                </Button>
                <Button
                  variant="danger"
                  loading={loading}
                  onClick={handleCancelAll}
                >
                  Cancel entire recurring series
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setConfirmOpen(false)}
                >
                  Keep sessions
                </Button>
              </>
            ) : (
              <div className="flex justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setConfirmOpen(false)}
                >
                  Keep Session
                </Button>
                <Button
                  variant="danger"
                  loading={loading}
                  onClick={handleDeleteOne}
                >
                  Yes, Cancel It
                </Button>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
