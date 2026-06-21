/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_GRAPHQL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace Intl {
  type DurationStyle = 'digital' | 'long' | 'narrow' | 'short';

  type DurationUnitStyle = 'long' | 'narrow' | 'short';

  type DurationUnitStyleFull =
    | '2-digit'
    | 'long'
    | 'narrow'
    | 'numeric'
    | 'short';

  interface DurationFormatOptions {
    days?: DurationUnitStyle;
    hours?: DurationUnitStyleFull;
    localeMatcher?: 'best fit' | 'lookup';
    minutes?: DurationUnitStyleFull;
    months?: DurationUnitStyle;
    seconds?: DurationUnitStyleFull;
    style?: DurationStyle;
    weeks?: DurationUnitStyle;
    years?: DurationUnitStyle;
  }

  interface DurationInput {
    days?: number;
    hours?: number;
    microseconds?: number;
    milliseconds?: number;
    minutes?: number;
    months?: number;
    nanoseconds?: number;
    seconds?: number;
    weeks?: number;
    years?: number;
  }

  class DurationFormat {
    public constructor(
      locale?: string | string[],
      options?: DurationFormatOptions
    );
    public format(duration: DurationInput): string;
    public formatToParts(
      duration: DurationInput
    ): Array<{ type: string; value: string }>;
    public resolvedOptions(): Required<DurationFormatOptions> & {
      locale: string;
    };
  }
}
