import { type SlotSuggestion } from '@game-reservations/shared';

export interface AuthPayload {
  token: string;
  user: AuthUser;
}
export interface AuthUser {
  createdAt: string;
  email: string;
  id: string;
  role: Role;
}
export interface GraphQLErrorExtensions {
  statusCode?: number;
  suggestedSlots?: SlotSuggestion[];
}
export type Role = 'ADMIN' | 'PLAYER';
export interface SessionFormValues {
  comment: string;
  endTime: string;
  playerName: string;
  startTime: string;
  status: 'ACTIVE' | 'COMPLETED';
}
export {
  type Arena,
  type AvailabilityResult,
  type Session,
  type SlotSuggestion
} from '@game-reservations/shared';
