/// <reference types="vite/client" />

declare namespace Intl {
  interface DurationFormatOptions {
    localeMatcher?: 'best fit' | 'lookup';
    style?: 'long' | 'short' | 'narrow' | 'digital';
    years?: 'long' | 'short' | 'narrow';
    months?: 'long' | 'short' | 'narrow';
    weeks?: 'long' | 'short' | 'narrow';
    days?: 'long' | 'short' | 'narrow';
    hours?: 'long' | 'short' | 'narrow' | 'numeric' | '2-digit';
    minutes?: 'long' | 'short' | 'narrow' | 'numeric' | '2-digit';
    seconds?: 'long' | 'short' | 'narrow' | 'numeric' | '2-digit';
  }

  interface DurationInput {
    years?: number;
    months?: number;
    weeks?: number;
    days?: number;
    hours?: number;
    minutes?: number;
    seconds?: number;
    milliseconds?: number;
    microseconds?: number;
    nanoseconds?: number;
  }

  class DurationFormat {
    constructor(locale?: string | string[], options?: DurationFormatOptions);
    format(duration: DurationInput): string;
    formatToParts(duration: DurationInput): Array<{ type: string; value: string }>;
    resolvedOptions(): Required<DurationFormatOptions> & { locale: string };
  }
}
