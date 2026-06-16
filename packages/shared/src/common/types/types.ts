export interface Arena {
  id: string;
  name: string;
  createdAt: string;
}

export type SessionStatus = "ACTIVE" | "COMPLETED";

export interface Session {
  id: string;
  arenaId: string;
  startTime: string;
  endTime: string;
  playerName?: string | null;
  comment?: string | null;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SlotSuggestion {
  startTime: string;
  endTime: string;
}

export interface AvailabilityResult {
  available: boolean;
  suggestedSlots?: SlotSuggestion[] | null;
}
