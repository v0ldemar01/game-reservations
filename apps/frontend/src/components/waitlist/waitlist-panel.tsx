import { useQuery, useMutation } from "@apollo/client";
import { MY_WAITLIST_ENTRIES } from "../../graphql/queries/arenas.js";
import { LEAVE_WAITLIST } from "../../graphql/mutations/waitlist.js";
import { formatDateTime } from "../../utils/date.js";
import { Button } from "../ui/button.js";
import { Spinner } from "../ui/spinner.js";

interface Props {
  arenaId: string;
}

export function WaitlistPanel({ arenaId }: Props) {
  const { data, loading, refetch } = useQuery(MY_WAITLIST_ENTRIES);
  const [leaveWaitlist] = useMutation(LEAVE_WAITLIST, {
    onCompleted: () => refetch(),
  });

  const allEntries: Array<{
    id: string;
    arenaId: string;
    startTime: string;
    endTime: string;
    notifiedAt: string | null;
    createdAt: string;
  }> = data?.myWaitlistEntries ?? [];

  const entries = allEntries.filter(
    (e) => String(e.arenaId) === String(arenaId),
  );

  if (loading)
    return (
      <div className="flex justify-center py-4">
        <Spinner size="md" />
      </div>
    );
  if (entries.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-400">
        No waitlist entries.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map((e) => (
        <div
          key={e.id}
          className={`flex items-start justify-between rounded-lg border p-3 ${
            e.notifiedAt
              ? "border-green-300 bg-green-50"
              : "border-gray-200 bg-white"
          }`}
        >
          <div className="flex flex-col gap-0.5">
            {e.notifiedAt && (
              <span className="text-xs font-semibold text-green-700">
                Slot available! Booked before it's taken.
              </span>
            )}
            <span className="text-sm font-medium text-gray-800">
              Arena {e.arenaId}
            </span>
            <span className="text-xs text-gray-500">
              {formatDateTime(e.startTime)} → {formatDateTime(e.endTime)}
            </span>
            <span className="text-xs text-gray-400">
              Joined {formatDateTime(e.createdAt)}
            </span>
          </div>
          <Button
            variant="ghost"
            onClick={() => leaveWaitlist({ variables: { id: e.id } })}
            className="text-xs"
          >
            Leave
          </Button>
        </div>
      ))}
    </div>
  );
}
