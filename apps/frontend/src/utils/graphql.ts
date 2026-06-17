import { type SlotSuggestion } from '@game-reservations/shared';

export function extractSuggestedSlotError(error: unknown): null | {
  message: string;
  suggestedSlots?: SlotSuggestion[];
} {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const error_ = error as {
    graphQLErrors?: Array<{
      extensions?: Record<string, unknown>;
      message: string;
    }>;
  };

  if (!error_.graphQLErrors?.length) {
    return null;
  }

  const [gqlError] = error_.graphQLErrors;

  return {
    message: gqlError.message,
    suggestedSlots: gqlError.extensions?.suggestedSlots as
      | SlotSuggestion[]
      | undefined
  };
}
