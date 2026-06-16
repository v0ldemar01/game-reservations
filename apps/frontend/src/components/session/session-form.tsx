import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { ApolloError, useLazyQuery, useMutation } from "@apollo/client";
import {
  Session,
  SessionFormValues,
  SlotSuggestion,
  AvailabilityResult,
} from "../../types.js";
import {
  CREATE_SESSION,
  UPDATE_SESSION,
} from "../../graphql/mutations/sessions.js";
import { CREATE_RECURRING_SESSIONS } from "../../graphql/mutations/recurring.js";
import { JOIN_WAITLIST } from "../../graphql/mutations/waitlist.js";
import {
  GET_SESSIONS,
  CHECK_AVAILABILITY,
  MY_WAITLIST_ENTRIES,
} from "../../graphql/queries/arenas.js";
import { Button } from "../ui/button.js";
import { ErrorMessage } from "../ui/error-message.js";
import { Spinner } from "../ui/spinner.js";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from "@game-reservations/shared";
import { toDatetimeLocal, formatDateTime } from "../../utils/date.js";
import { extractSuggestedSlotError } from "../../utils/graphql.js";

interface Props {
  arenaId: string;
  date: string;
  dayStart: string;
  dayEnd: string;
  session: Session | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function buildDefaultStartTime(date: string): string {
  return `${date}T12:00`;
}
function buildDefaultEndTime(date: string): string {
  return `${date}T13:00`;
}

export function SessionForm({
  arenaId,
  date,
  dayStart,
  dayEnd,
  session,
  onSuccess,
  onCancel,
}: Props) {
  const isEdit = session !== null;
  const [serverError, setServerError] = useState<string | null>(null);
  const [suggestedSlots, setSuggestedSlots] = useState<SlotSuggestion[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState(new Date().getDay());
  const [weeksAhead, setWeeksAhead] = useState(4);
  const [joinedWaitlist, setJoinedWaitlist] = useState(false);
  // duration-mode: when true the user specifies minutes instead of an end time
  const [durationMode, setDurationMode] = useState(false);
  const [durationInput, setDurationInput] = useState(60);
  const availTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextAvailCheckRef = useRef(false);

  // Always refetch page 1 after a mutation so the user sees fresh results from the top
  const refetchVars = {
    arenaId,
    dayStart,
    dayEnd,
    page: DEFAULT_PAGE,
    pageSize: DEFAULT_PAGE_SIZE,
  };

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SessionFormValues>({
    defaultValues: {
      startTime: isEdit
        ? toDatetimeLocal(session.startTime)
        : buildDefaultStartTime(date),
      endTime: isEdit
        ? toDatetimeLocal(session.endTime)
        : buildDefaultEndTime(date),
      playerName: session?.playerName ?? "",
      comment: session?.comment ?? "",
      status: (session?.status as "ACTIVE" | "COMPLETED") ?? "ACTIVE",
    },
  });

  const startTime = watch("startTime");
  const endTime = watch("endTime");

  const durationMinutes =
    startTime && endTime
      ? (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60_000
      : null;

  const [createSession] = useMutation(CREATE_SESSION, {
    refetchQueries: [{ query: GET_SESSIONS, variables: refetchVars }],
  });
  const [updateSession] = useMutation(UPDATE_SESSION, {
    refetchQueries: [{ query: GET_SESSIONS, variables: refetchVars }],
  });
  const [createRecurring] = useMutation(CREATE_RECURRING_SESSIONS, {
    refetchQueries: [{ query: GET_SESSIONS, variables: refetchVars }],
  });
  const [joinWaitlist, { loading: waitlistLoading }] = useMutation(
    JOIN_WAITLIST,
    {
      refetchQueries: [{ query: MY_WAITLIST_ENTRIES }],
    },
  );

  const [checkAvailability, { data: availData, loading: availLoading }] =
    useLazyQuery<{
      checkAvailability: AvailabilityResult;
    }>(CHECK_AVAILABILITY);

  useEffect(() => {
    if (availTimerRef.current) clearTimeout(availTimerRef.current);
    setServerError(null);
    setSuggestedSlots([]);
    setJoinedWaitlist(false);

    if (skipNextAvailCheckRef.current) {
      skipNextAvailCheckRef.current = false;
      return;
    }

    if (!startTime || !endTime) return;
    const durationMs =
      new Date(endTime).getTime() - new Date(startTime).getTime();
    if (durationMs < 5 * 60 * 1000 || durationMs > 24 * 60 * 60 * 1000) return;

    availTimerRef.current = setTimeout(() => {
      checkAvailability({
        variables: {
          input: {
            arenaId,
            startTime: new Date(startTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
          },
        },
      });
    }, 500);
    return () => {
      if (availTimerRef.current) clearTimeout(availTimerRef.current);
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
              id: session.id,
              startTime: new Date(values.startTime).toISOString(),
              endTime: new Date(values.endTime).toISOString(),
              playerName: values.playerName || null,
              comment: values.comment || null,
              status: values.status,
            },
          },
        });
      } else if (isRecurring) {
        const startDate = new Date(values.startTime);
        const endDate = new Date(values.endTime);
        const result = await createRecurring({
          variables: {
            input: {
              arenaId,
              dayOfWeek,
              startHour: startDate.getHours(),
              startMin: startDate.getMinutes(),
              endHour: endDate.getHours(),
              endMin: endDate.getMinutes(),
              weeksAhead,
              playerName: values.playerName || null,
              comment: values.comment || null,
            },
          },
        });
        const { createdCount, skippedCount } =
          result.data?.createRecurringSessions ?? {};
        if (skippedCount > 0) {
          setServerError(
            `Recurring series created: ${createdCount} sessions booked, ${skippedCount} skipped (arena full at those times).`,
          );
          return;
        }
      } else {
        await createSession({
          variables: {
            input: {
              arenaId,
              startTime: new Date(values.startTime).toISOString(),
              endTime: new Date(values.endTime).toISOString(),
              playerName: values.playerName || null,
              comment: values.comment || null,
            },
          },
        });
      }
      onSuccess();
    } catch (err) {
      const parsed = extractSuggestedSlotError(err);
      if (parsed) {
        setServerError(parsed.message);
        setSuggestedSlots(parsed.suggestedSlots ?? []);
      } else if (err instanceof ApolloError && err.networkError) {
        setServerError(
          "Network error. Please check your connection and try again.",
        );
      } else {
        setServerError("An unexpected error occurred. Please try again.");
      }
    }
  };

  const handleJoinWaitlist = async () => {
    if (!startTime || !endTime) return;
    await joinWaitlist({
      variables: {
        input: {
          arenaId,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
        },
      },
    });
    setJoinedWaitlist(true);
  };

  const applySuggestion = (slot: SlotSuggestion) => {
    setDurationMode(false);
    skipNextAvailCheckRef.current = true;
    setValue("startTime", toDatetimeLocal(slot.startTime));
    setValue("endTime", toDatetimeLocal(slot.endTime));
    checkAvailability({
      variables: {
        input: { arenaId, startTime: slot.startTime, endTime: slot.endTime },
      },
    });
  };

  const availResult = availData?.checkAvailability;
  const showAvailability =
    !isEdit && availResult !== undefined && !availLoading;

  useEffect(() => {
    if (durationMode && startTime) {
      const computed = new Date(
        new Date(startTime).getTime() + durationInput * 60_000,
      );
      if (!isNaN(computed.getTime())) {
        setValue("endTime", toDatetimeLocal(computed.toISOString()));
      }
    }
  }, [startTime, durationMode, durationInput]);

  const handleDurationInputChange = (minutes: number) => {
    setDurationInput(minutes);
    if (startTime) {
      const computed = new Date(
        new Date(startTime).getTime() + minutes * 60_000,
      );
      if (!isNaN(computed.getTime())) {
        setValue("endTime", toDatetimeLocal(computed.toISOString()));
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-5"
      noValidate
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="startTime"
            className="text-sm font-medium text-gray-700"
          >
            Start Time
          </label>
          <input
            id="startTime"
            type="datetime-local"
            {...register("startTime", { required: "Start time is required" })}
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
            type="button"
            onClick={() => setDurationMode(false)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              !durationMode
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            End time
          </button>
          <button
            type="button"
            onClick={() => setDurationMode(true)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              durationMode
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Duration
          </button>
        </div>

        {durationMode ? (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="durationInput"
              className="text-sm font-medium text-gray-700"
            >
              Duration (minutes)
            </label>
            <input
              id="durationInput"
              type="number"
              min={5}
              max={1440}
              value={durationInput}
              onChange={(e) =>
                handleDurationInputChange(Number(e.target.value))
              }
              className="w-36 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <input type="hidden" {...register("endTime", { required: true })} />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="endTime"
              className="text-sm font-medium text-gray-700"
            >
              End Time
            </label>
            <input
              id="endTime"
              type="datetime-local"
              {...register("endTime", { required: "End time is required" })}
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
              className={`text-xs ${durationMinutes < 5 || durationMinutes > 1440 ? "text-red-500" : "text-gray-500"}`}
            >
              {durationMinutes < 0
                ? "End time must be after start time"
                : durationMinutes < 5
                  ? "Minimum duration is 5 minutes"
                  : durationMinutes > 1440
                    ? "Maximum duration is 24 hours"
                    : `Duration: ${Math.floor(durationMinutes / 60)}h ${Math.round(durationMinutes % 60)}m`}
            </p>
          )}
          {availLoading && <Spinner size="sm" />}
          {showAvailability && (
            <span
              className={`text-xs font-medium ${availResult.available ? "text-green-600" : "text-red-500"}`}
            >
              {availResult.available
                ? "✓ Slot available"
                : "✗ Slot unavailable"}
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
                  {availResult.suggestedSlots.map((slot, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applySuggestion(slot)}
                      className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-xs shadow-sm border border-amber-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
                    >
                      <span className="font-medium text-gray-900">
                        {formatDateTime(slot.startTime)} →{" "}
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
          htmlFor="playerName"
          className="text-sm font-medium text-gray-700"
        >
          Player Name{" "}
          <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <input
          id="playerName"
          type="text"
          maxLength={100}
          placeholder="e.g. Alice"
          {...register("playerName")}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="comment" className="text-sm font-medium text-gray-700">
          Comment <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <textarea
          id="comment"
          rows={2}
          maxLength={500}
          placeholder="Any notes about this session..."
          {...register("comment")}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />
      </div>

      {isEdit && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-sm font-medium text-gray-700">
            Status
          </label>
          <select
            id="status"
            {...register("status")}
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
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
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
                  {DAY_NAMES.map((name, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setDayOfWeek(i)}
                      className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                        dayOfWeek === i
                          ? "bg-blue-600 text-white"
                          : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {name.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600 whitespace-nowrap">
                  Weeks ahead
                </label>
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={weeksAhead}
                  onChange={(e) => setWeeksAhead(Number(e.target.value))}
                  className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                {suggestedSlots.map((slot, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applySuggestion(slot)}
                    className="flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm shadow-sm border border-amber-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
                  >
                    <span className="font-medium text-gray-900">
                      {formatDateTime(slot.startTime)} →{" "}
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
                type="button"
                variant="secondary"
                loading={waitlistLoading}
                onClick={handleJoinWaitlist}
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
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {isEdit
            ? "Save Changes"
            : isRecurring
              ? `Book ${weeksAhead} Sessions`
              : "Book Session"}
        </Button>
      </div>
    </form>
  );
}
