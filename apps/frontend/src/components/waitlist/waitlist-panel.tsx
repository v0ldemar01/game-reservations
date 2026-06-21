import { useMutation, useQuery } from '@apollo/client';

import { LEAVE_WAITLIST } from '../../graphql/mutations/waitlist.js';
import { MY_WAITLIST_ENTRIES } from '../../graphql/queries/arenas.js';
import { formatDateTime } from '../../utils/date.js';
import { Button } from '../ui/button.js';
import { Spinner } from '../ui/spinner.js';

interface Properties {
  arenaId: string;
}

interface WaitlistData {
  myWaitlistEntries: WaitlistEntry[];
}

interface WaitlistEntry {
  arenaId: string;
  createdAt: string;
  endTime: string;
  id: string;
  notifiedAt: null | string;
  startTime: string;
}

export function WaitlistPanel({ arenaId }: Readonly<Properties>) {
  const { data, loading, refetch } =
    useQuery<WaitlistData>(MY_WAITLIST_ENTRIES);
  const [leaveWaitlist] = useMutation(LEAVE_WAITLIST, {
    onCompleted: () => {
      void refetch();
    }
  });

  const allEntries: WaitlistEntry[] = data?.myWaitlistEntries ?? [];

  const entries = allEntries.filter((entry) => entry.arenaId === arenaId);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner size="md" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-gray-400">
        No waitlist entries.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) => (
        <div
          className={`flex items-start justify-between rounded-lg border p-3 ${
            entry.notifiedAt
              ? 'border-green-300 bg-green-50'
              : 'border-gray-200 bg-white'
          }`}
          key={entry.id}
        >
          <div className="flex flex-col gap-0.5">
            {entry.notifiedAt && (
              <span className="text-xs font-semibold text-green-700">
                Slot available! Booked before it's taken.
              </span>
            )}
            <span className="text-sm font-medium text-gray-800">
              Arena {entry.arenaId}
            </span>
            <span className="text-xs text-gray-500">
              {formatDateTime(entry.startTime)} →{' '}
              {formatDateTime(entry.endTime)}
            </span>
            <span className="text-xs text-gray-400">
              Joined {formatDateTime(entry.createdAt)}
            </span>
          </div>
          <Button
            className="text-xs"
            onClick={() => {
              void leaveWaitlist({ variables: { id: entry.id } });
            }}
            variant="ghost"
          >
            Leave
          </Button>
        </div>
      ))}
    </div>
  );
}
