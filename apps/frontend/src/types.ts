export type {
  Arena,
  Session,
  SlotSuggestion,
  AvailabilityResult,
} from "@game-reservations/shared";

export type Role = "ADMIN" | "PLAYER";

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface AuthPayload {
  token: string;
  user: AuthUser;
}

import type { SlotSuggestion } from "@game-reservations/shared";

export interface GraphQLErrorExtensions {
  statusCode?: number;
  suggestedSlots?: SlotSuggestion[];
}

export interface SessionFormValues {
  startTime: string;
  endTime: string;
  playerName: string;
  comment: string;
  status: "ACTIVE" | "COMPLETED";
}
