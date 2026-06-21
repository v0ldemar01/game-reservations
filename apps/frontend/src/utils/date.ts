import { Temporal } from '@js-temporal/polyfill';

const MS_PER_MIN = 60_000;
const DATETIME_LOCAL_LENGTH = 16;

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  hour12: false,
  minute: '2-digit'
});

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  hour: '2-digit',
  hour12: false,
  minute: '2-digit',
  month: 'short',
  year: 'numeric'
});

const durationFormatter = new Intl.DurationFormat(undefined, {
  style: 'narrow'
});

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short'
});

const shortDateWithYearFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
});

export function addDaysToDate(dateString: string, days: number): string {
  return Temporal.PlainDate.from(dateString).add({ days }).toString();
}

export function dayOfMonth(dateString: string): number {
  return Temporal.PlainDate.from(dateString).day;
}

export function durationMinutes(startIso: string, endIso: string): number {
  return (
    (Temporal.Instant.from(endIso).epochMilliseconds -
      Temporal.Instant.from(startIso).epochMilliseconds) /
    MS_PER_MIN
  );
}

export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(Temporal.Instant.from(iso).epochMilliseconds);
}

export function formatDuration(startIso: string, endIso: string): string {
  const duration = Temporal.Instant.from(startIso).until(
    Temporal.Instant.from(endIso),
    { largestUnit: 'hour' }
  );

  return durationFormatter.format({
    hours: duration.hours,
    minutes: duration.minutes
  });
}

export function formatShortDate(dateString: string): string {
  return shortDateFormatter.format(
    Temporal.PlainDate.from(dateString).toZonedDateTime(
      Temporal.Now.timeZoneId()
    ).epochMilliseconds
  );
}

export function formatShortDateWithYear(dateString: string): string {
  return shortDateWithYearFormatter.format(
    Temporal.PlainDate.from(dateString).toZonedDateTime(
      Temporal.Now.timeZoneId()
    ).epochMilliseconds
  );
}

export function formatTime(iso: string): string {
  return timeFormatter.format(Temporal.Instant.from(iso).epochMilliseconds);
}

export function instantToPlainDate(iso: string): string {
  return Temporal.Instant.from(iso)
    .toZonedDateTimeISO(Temporal.Now.timeZoneId())
    .toPlainDate()
    .toString();
}

export function localDayBounds(dateString: string): {
  dayEnd: string;
  dayStart: string;
} {
  const tz = Temporal.Now.timeZoneId();
  const date = Temporal.PlainDate.from(dateString);

  return {
    dayEnd: date.add({ days: 1 }).toZonedDateTime(tz).toInstant().toString(),
    dayStart: date.toZonedDateTime(tz).toInstant().toString()
  };
}

export function mondayOfWeek(dateString: string): string {
  const date = Temporal.PlainDate.from(dateString);

  // dayOfWeek is 1=Monday … 7=Sunday (ISO 8601)
  return date.subtract({ days: date.dayOfWeek - 1 }).toString();
}

export function toDatetimeLocal(iso: string): string {
  return Temporal.Instant.from(iso)
    .toZonedDateTimeISO(Temporal.Now.timeZoneId())
    .toString()
    .slice(0, DATETIME_LOCAL_LENGTH);
}

export function todayISO(): string {
  return Temporal.Now.plainDateISO().toString();
}

export function weekBounds(weekStartString: string): {
  dayEnd: string;
  dayStart: string;
} {
  const tz = Temporal.Now.timeZoneId();
  const start = Temporal.PlainDate.from(weekStartString);

  return {
    dayEnd: start.add({ days: 7 }).toZonedDateTime(tz).toInstant().toString(),
    dayStart: start.toZonedDateTime(tz).toInstant().toString()
  };
}
