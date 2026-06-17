import { ApolloError, useLazyQuery, useMutation } from '@apollo/client';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from '@game-reservations/shared';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';

import { CREATE_RECURRING_SESSIONS } from '../../graphql/mutations/recurring.js';
import {
  CREATE_SESSION,
  UPDATE_SESSION
} from '../../graphql/mutations/sessions.js';
import { JOIN_WAITLIST } from '../../graphql/mutations/waitlist.js';
import {
  CHECK_AVAILABILITY,
  GET_SESSIONS,
  MY_WAITLIST_ENTRIES
} from '../../graphql/queries/arenas.js';
import {
  type AvailabilityResult,
  type Session,
  type SessionFormValues,
  type SlotSuggestion
} from '../../types.js';
import { formatDateTime, toDatetimeLocal } from '../../utils/date.js';
import { extractSuggestedSlotError } from '../../utils/graphql.js';
import { Button } from '../ui/button.js';
import { ErrorMessage } from '../ui/error-message.js';
import { Spinner } from '../ui/spinner.js';

interface Properties {
  arenaId: string;
  date: string;
  dayEnd: string;
  dayStart: string;
  onCancel: () => void;
  onSuccess: () => void;
  session: null | Session;
}

interface RecurringSessionsResult {
  createRecurringSessions: {
    createdCount: number;
    skippedCount: number;
  };
}

const AVAIL_DEBOUNCE_MS = 500;
const DAY_ABBREV_LENGTH = 3;
const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_WEEKS_AHEAD = 4;
const MAX_DURATION_MINUTES = 1440;
const MIN_DURATION_MINUTES = 5;
const MINUTES_PER_HOUR = 60;
const MS_PER_MIN = 60_000;
const MIN_DURATION_MS = MIN_DURATION_MINUTES * MS_PER_MIN;
const MAX_DURATION_MS = MAX_DURATION_MINUTES * MS_PER_MIN;

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

export function buildDefaultEndTime(date: string): string {
  return `${date}T13:00`;
}

export function buildDefaultStartTime(date: string): string {
  return `${date}T12:00`;
}

export function formatDurationMessage(minutes: number): string {
  if (minutes < 0) {
    return 'End time must be after start time';
  }

  if (minutes < MIN_DURATION_MINUTES) {
    return 'Minimum duration is 5 minutes';
  }

  if (minutes > MAX_DURATION_MINUTES) {
    return 'Maximum duration is 24 hours';
  }

  return `Duration: ${Math.floor(minutes / MINUTES_PER_HOUR)}h ${Math.round(minutes % MINUTES_PER_HOUR)}m`;
}

export function getSubmitError(error: unknown): {
  message: string;
  slots: SlotSuggestion[];
} {
  const parsed = extractSuggestedSlotError(error);

  if (parsed) {
    return { message: parsed.message, slots: parsed.suggestedSlots ?? [] };
  }

  if (error instanceof ApolloError && error.networkError) {
    return {
      message: 'Network error. Please check your connection and try again.',
      slots: []
    };
  }

  return {
    message: 'An unexpected error occurred. Please try again.',
    slots: []
  };
}

export function getSubmitLabel(
  isEdit: boolean,
  isRecurring: boolean,
  weeksAhead: number
): string {
  if (isEdit) {
    return 'Save Changes';
  }

  if (isRecurring) {
    return `Book ${weeksAhead} Sessions`;
  }

  return 'Book Session';
}

export function SessionForm({
  arenaId,
  date,
  dayEnd,
  dayStart,
  onCancel,
  onSuccess,
  session
}: Readonly<Properties>) {
  const isEdit = session !== null;
  const [serverError, setServerError] = useState<null | string>(null);
  const [suggestedSlots, setSuggestedSlots] = useState<SlotSuggestion[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState(new Date().getDay());
  const [weeksAhead, setWeeksAhead] = useState(DEFAULT_WEEKS_AHEAD);
  const [joinedWaitlist, setJoinedWaitlist] = useState(false);
  const [durationMode, setDurationMode] = useState(false);
  const [durationInput, setDurationInput] = useState(DEFAULT_DURATION_MINUTES);
  const availTimerReference = useRef<null | ReturnType<typeof setTimeout>>(
    null
  );
  const skipNextAvailCheckReference = useRef(false);

  const refetchVariables = {
    arenaId,
    dayEnd,
    dayStart,
    page: DEFAULT_PAGE,
    pageSize: DEFAULT_PAGE_SIZE
  };

  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setValue,
    watch
  } = useForm<SessionFormValues>({
    defaultValues: {
      comment: session?.comment ?? '',
      endTime: isEdit
        ? toDatetimeLocal(session.endTime)
        : buildDefaultEndTime(date),
      playerName: session?.playerName ?? '',
      startTime: isEdit
        ? toDatetimeLocal(session.startTime)
        : buildDefaultStartTime(date),
      status: (session?.status ?? 'ACTIVE') as 'ACTIVE' | 'COMPLETED'
    }
  });

  const startTime = watch('startTime');
  const endTime = watch('endTime');

  const durationMinutes =
    startTime && endTime
      ? (new Date(endTime).getTime() - new Date(startTime).getTime()) /
        MS_PER_MIN
      : null;

  const [createSession] = useMutation(CREATE_SESSION, {
    refetchQueries: [{ query: GET_SESSIONS, variables: refetchVariables }]
  });
  const [updateSession] = useMutation(UPDATE_SESSION, {
    refetchQueries: [{ query: GET_SESSIONS, variables: refetchVariables }]
  });
  const [createRecurring] = useMutation<RecurringSessionsResult>(
    CREATE_RECURRING_SESSIONS,
    {
      refetchQueries: [{ query: GET_SESSIONS, variables: refetchVariables }]
    }
  );
  const [joinWaitlist, { loading: waitlistLoading }] = useMutation(
    JOIN_WAITLIST,
    {
      refetchQueries: [{ query: MY_WAITLIST_ENTRIES }]
    }
  );

  const [checkAvailability, { data: availData, loading: availLoading }] =
    useLazyQuery<{
      checkAvailability: AvailabilityResult;
    }>(CHECK_AVAILABILITY);

  useEffect(() => {
    if (availTimerReference.current) {
      clearTimeout(availTimerReference.current);
    }

    setServerError(null);
    setSuggestedSlots([]);
    setJoinedWaitlist(false);

    const shouldSkip = skipNextAvailCheckReference.current;
    skipNextAvailCheckReference.current = false;

    if (shouldSkip || !startTime || !endTime) {
      return;
    }

    const durationMs =
      new Date(endTime).getTime() - new Date(startTime).getTime();

    if (durationMs < MIN_DURATION_MS || durationMs > MAX_DURATION_MS) {
      return;
    }

    availTimerReference.current = setTimeout(() => {
      void checkAvailability({
        variables: {
          input: {
            arenaId,
            endTime: new Date(endTime).toISOString(),
            startTime: new Date(startTime).toISOString()
          }
        }
      });
    }, AVAIL_DEBOUNCE_MS);

    return () => {
      if (availTimerReference.current) {
        clearTimeout(availTimerReference.current);
      }
    };
  }, [startTime, endTime, arenaId, checkAvailability]);

  const onSubmit = async (values: SessionFormValues) => {
    setServerError(null);
    setSuggestedSlots([]);
    setJoinedWaitlist(false);

    try {
      if (isEdit) {
        await updateSession({
          variables: {
            input: {
              comment: values.comment || null,
              endTime: new Date(values.endTime).toISOString(),
              id: session.id,
              playerName: values.playerName || null,
              startTime: new Date(values.startTime).toISOString(),
              status: values.status
            }
          }
        });
      } else if (isRecurring) {
        const startDate = new Date(values.startTime);
        const endDate = new Date(values.endTime);
        const result = await createRecurring({
          variables: {
            input: {
              arenaId,
              comment: values.comment || null,
              dayOfWeek,
              endHour: endDate.getHours(),
              endMin: endDate.getMinutes(),
              playerName: values.playerName || null,
              startHour: startDate.getHours(),
              startMin: startDate.getMinutes(),
              weeksAhead
            }
          }
        });
        const { createdCount = 0, skippedCount = 0 } =
          result.data?.createRecurringSessions ?? {};

        if (skippedCount > 0) {
          setServerError(
            `Recurring series created: ${createdCount} sessions booked, ${skippedCount} skipped (arena full at those times).`
          );

          return;
        }
      } else {
        await createSession({
          variables: {
            input: {
              arenaId,
              comment: values.comment || null,
              endTime: new Date(values.endTime).toISOString(),
              playerName: values.playerName || null,
              startTime: new Date(values.startTime).toISOString()
            }
          }
        });
      }

      onSuccess();
    } catch (error) {
      const { message, slots } = getSubmitError(error);
      setServerError(message);
      setSuggestedSlots(slots);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!startTime || !endTime) {
      return;
    }

    await joinWaitlist({
      variables: {
        input: {
          arenaId,
          endTime: new Date(endTime).toISOString(),
          startTime: new Date(startTime).toISOString()
        }
      }
    });
    setJoinedWaitlist(true);
  };

  const applySuggestion = (slot: SlotSuggestion) => {
    setDurationMode(false);
    skipNextAvailCheckReference.current = true;
    setValue('startTime', toDatetimeLocal(slot.startTime));
    setValue('endTime', toDatetimeLocal(slot.endTime));
    void checkAvailability({
      variables: {
        input: { arenaId, endTime: slot.endTime, startTime: slot.startTime }
      }
    });
  };

  const availResult = availData?.checkAvailability;
  const showAvailability =
    !isEdit && availResult !== undefined && !availLoading;

  useEffect(() => {
    if (durationMode && startTime) {
      const computed = new Date(
        new Date(startTime).getTime() + durationInput * MS_PER_MIN
      );

      if (!Number.isNaN(computed.getTime())) {
        setValue('endTime', toDatetimeLocal(computed.toISOString()));
      }
    }
  }, [startTime, durationMode, durationInput]);

  const handleDurationInputChange = (minutes: number) => {
    setDurationInput(minutes);

    if (startTime) {
      const computed = new Date(
        new Date(startTime).getTime() + minutes * MS_PER_MIN
      );

      if (!Number.isNaN(computed.getTime())) {
        setValue('endTime', toDatetimeLocal(computed.toISOString()));
      }
    }
  };

  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={handleSubmit(onSubmit)}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label
            className="text-sm font-medium text-gray-700"
            htmlFor="startTime"
          >
            Start Time
          </label>
          <input
            id="startTime"
            type="datetime-local"
            {...register('startTime', { required: 'Start time is required' })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {errors.startTime && (
            <span className="text-xs text-red-600">
              {errors.startTime.message}
            </span>
          )}
        </div>

        <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 self-start">
          <button
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              durationMode
                ? 'text-gray-500 hover:text-gray-700'
                : 'bg-white text-blue-700 shadow-sm'
            }`}
            onClick={() => {
              setDurationMode(false);
            }}
            type="button"
          >
            End time
          </button>
          <button
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              durationMode
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => {
              setDurationMode(true);
            }}
            type="button"
          >
            Duration
          </button>
        </div>

        {durationMode ? (
          <div className="flex flex-col gap-1.5">
            <label
              className="text-sm font-medium text-gray-700"
              htmlFor="durationInput"
            >
              Duration (minutes)
            </label>
            <input
              className="w-36 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              id="durationInput"
              max={1440}
              min={5}
              onChange={(event_) => {
                handleDurationInputChange(Number(event_.target.value));
              }}
              type="number"
              value={durationInput}
            />
            <input type="hidden" {...register('endTime', { required: true })} />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label
              className="text-sm font-medium text-gray-700"
              htmlFor="endTime"
            >
              End Time
            </label>
            <input
              id="endTime"
              type="datetime-local"
              {...register('endTime', { required: 'End time is required' })}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {errors.endTime && (
              <span className="text-xs text-red-600">
                {errors.endTime.message}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="-mt-2 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {durationMinutes !== null && (
            <p
              className={`text-xs ${durationMinutes < MIN_DURATION_MINUTES || durationMinutes > MAX_DURATION_MINUTES ? 'text-red-500' : 'text-gray-500'}`}
            >
              {formatDurationMessage(durationMinutes)}
            </p>
          )}
          {availLoading && <Spinner size="sm" />}
          {showAvailability && (
            <span
              className={`text-xs font-medium ${availResult.available ? 'text-green-600' : 'text-red-500'}`}
            >
              {availResult.available
                ? '✓ Slot available'
                : '✗ Slot unavailable'}
            </span>
          )}
        </div>

        {showAvailability && !availResult.available && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
            {availResult.suggestedSlots &&
            availResult.suggestedSlots.length > 0 ? (
              <>
                <p className="mb-2 text-xs font-medium text-amber-800">
                  Available slots nearby:
                </p>
                <div className="flex flex-col gap-1.5">
                  {availResult.suggestedSlots.map((slot, index) => (
                    <button
                      className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-xs shadow-sm border border-amber-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
                      key={index}
                      onClick={() => {
                        applySuggestion(slot);
                      }}
                      type="button"
                    >
                      <span className="font-medium text-gray-900">
                        {formatDateTime(slot.startTime)} →{' '}
                        {formatDateTime(slot.endTime)}
                      </span>
                      <span className="text-xs text-blue-600 font-medium">
                        Use →
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-amber-800">
                No nearby slots found. Try a different time or join the waitlist
                after booking.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          className="text-sm font-medium text-gray-700"
          htmlFor="playerName"
        >
          Player Name{' '}
          <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <input
          id="playerName"
          maxLength={100}
          placeholder="e.g. Alice"
          type="text"
          {...register('playerName')}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700" htmlFor="comment">
          Comment <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <textarea
          id="comment"
          maxLength={500}
          placeholder="Any notes about this session..."
          rows={2}
          {...register('comment')}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />
      </div>

      {isEdit && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700" htmlFor="status">
            Status
          </label>
          <select
            id="status"
            {...register('status')}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ACTIVE">Active</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      )}

      {!isEdit && (
        <div className="flex flex-col gap-3 rounded-md border border-gray-200 p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              checked={isRecurring}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
              onChange={(event_) => {
                setIsRecurring(event_.target.checked);
              }}
              type="checkbox"
            />
            <span className="text-sm font-medium text-gray-700">
              Repeat weekly
            </span>
          </label>

          {isRecurring && (
            <div className="flex flex-col gap-3 pl-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600">
                  Day of week
                </label>
                <div className="flex flex-wrap gap-1">
                  {DAY_NAMES.map((name, index) => (
                    <button
                      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                        dayOfWeek === index
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                      key={index}
                      onClick={() => {
                        setDayOfWeek(index);
                      }}
                      type="button"
                    >
                      {name.slice(0, DAY_ABBREV_LENGTH)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600 whitespace-nowrap">
                  Weeks ahead
                </label>
                <input
                  className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  max={52}
                  min={1}
                  onChange={(event_) => {
                    setWeeksAhead(Number(event_.target.value));
                  }}
                  type="number"
                  value={weeksAhead}
                />
                <span className="text-xs text-gray-400">
                  ({weeksAhead} sessions will be created)
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {serverError && (
        <div className="flex flex-col gap-3">
          <ErrorMessage message={serverError} />

          {suggestedSlots.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
              <p className="mb-2 text-sm font-medium text-amber-800">
                Available slots nearby:
              </p>
              <div className="flex flex-col gap-2">
                {suggestedSlots.map((slot, index) => (
                  <button
                    className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm shadow-sm border border-amber-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
                    key={index}
                    onClick={() => {
                      applySuggestion(slot);
                    }}
                    type="button"
                  >
                    <span className="font-medium text-gray-900">
                      {formatDateTime(slot.startTime)} →{' '}
                      {formatDateTime(slot.endTime)}
                    </span>
                    <span className="text-xs text-blue-600 font-medium">
                      Use this slot →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!isEdit && !joinedWaitlist && suggestedSlots.length === 0 && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <p className="mb-2 text-sm text-gray-600">
                No nearby slots found. Join the waitlist and we'll notify you
                when one opens up.
              </p>
              <Button
                loading={waitlistLoading}
                onClick={() => {
                  void handleJoinWaitlist();
                }}
                type="button"
                variant="secondary"
              >
                Join Waitlist
              </Button>
            </div>
          )}

          {joinedWaitlist && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700 font-medium">
              You've joined the waitlist. We'll notify you when this slot opens.
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 border-t pt-4">
        <Button onClick={onCancel} type="button" variant="secondary">
          Cancel
        </Button>
        <Button loading={isSubmitting} type="submit">
          {getSubmitLabel(isEdit, isRecurring, weeksAhead)}
        </Button>
      </div>
    </form>
  );
}
