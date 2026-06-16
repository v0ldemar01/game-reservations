import { Temporal } from "@js-temporal/polyfill";

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const durationFormatter = new Intl.DurationFormat(undefined, {
  style: "narrow",
});

export function formatTime(iso: string): string {
  return timeFormatter.format(Temporal.Instant.from(iso).epochMilliseconds);
}

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(Temporal.Instant.from(iso).epochMilliseconds);
}

export function formatDuration(startIso: string, endIso: string): string {
  const duration = Temporal.Instant.from(startIso).until(
    Temporal.Instant.from(endIso),
    { largestUnit: "hour" },
  );
  return durationFormatter.format({
    hours: duration.hours,
    minutes: duration.minutes,
  });
}

export function toDatetimeLocal(iso: string): string {
  return Temporal.Instant.from(iso)
    .toZonedDateTimeISO(Temporal.Now.timeZoneId())
    .toString()
    .slice(0, 16);
}

export function todayISO(): string {
  return Temporal.Now.plainDateISO().toString();
}

export function localDayBounds(dateStr: string): {
  dayStart: string;
  dayEnd: string;
} {
  const tz = Temporal.Now.timeZoneId();
  const date = Temporal.PlainDate.from(dateStr);
  return {
    dayStart: date.toZonedDateTime(tz).toInstant().toString(),
    dayEnd: date.add({ days: 1 }).toZonedDateTime(tz).toInstant().toString(),
  };
}

export function weekBounds(weekStartStr: string): {
  dayStart: string;
  dayEnd: string;
} {
  const tz = Temporal.Now.timeZoneId();
  const start = Temporal.PlainDate.from(weekStartStr);
  return {
    dayStart: start.toZonedDateTime(tz).toInstant().toString(),
    dayEnd: start.add({ days: 7 }).toZonedDateTime(tz).toInstant().toString(),
  };
}

export function addDaysToDate(dateStr: string, days: number): string {
  return Temporal.PlainDate.from(dateStr).add({ days }).toString();
}

export function mondayOfWeek(dateStr: string): string {
  const date = Temporal.PlainDate.from(dateStr);
  // dayOfWeek is 1=Monday … 7=Sunday (ISO 8601)
  return date.subtract({ days: date.dayOfWeek - 1 }).toString();
}

export function instantToPlainDate(iso: string): string {
  return Temporal.Instant.from(iso)
    .toZonedDateTimeISO(Temporal.Now.timeZoneId())
    .toPlainDate()
    .toString();
}

export function dayOfMonth(dateStr: string): number {
  return Temporal.PlainDate.from(dateStr).day;
}

export function durationMinutes(startIso: string, endIso: string): number {
  return (
    (Temporal.Instant.from(endIso).epochMilliseconds -
      Temporal.Instant.from(startIso).epochMilliseconds) /
    60_000
  );
}

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

const shortDateWithYearFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function plainDateEpochMs(dateStr: string): number {
  return Temporal.PlainDate.from(dateStr).toZonedDateTime(
    Temporal.Now.timeZoneId(),
  ).epochMilliseconds;
}

export function formatShortDate(dateStr: string): string {
  return shortDateFormatter.format(plainDateEpochMs(dateStr));
}

export function formatShortDateWithYear(dateStr: string): string {
  return shortDateWithYearFormatter.format(plainDateEpochMs(dateStr));
}
