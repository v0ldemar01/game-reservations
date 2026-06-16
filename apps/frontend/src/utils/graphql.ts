import type { SlotSuggestion } from "@game-reservations/shared";

export function extractSuggestedSlotError(error: unknown): {
  message: string;
  suggestedSlots?: SlotSuggestion[];
} | null {
  if (!error || typeof error !== "object") return null;
  const err = error as {
    graphQLErrors?: Array<{
      message: string;
      extensions?: Record<string, unknown>;
    }>;
  };
  if (!err.graphQLErrors?.length) return null;

  const gqlErr = err.graphQLErrors[0];
  return {
    message: gqlErr.message,
    suggestedSlots: gqlErr.extensions?.suggestedSlots as
      | SlotSuggestion[]
      | undefined,
  };
}
