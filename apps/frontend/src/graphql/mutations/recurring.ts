import { gql } from "@apollo/client";

export const CREATE_RECURRING_SESSIONS = gql`
  mutation CreateRecurringSessions($input: CreateRecurringInput!) {
    createRecurringSessions(input: $input) {
      group {
        id
        dayOfWeek
        startHour
        startMin
        endHour
        endMin
        weeksAhead
      }
      createdCount
      skippedCount
    }
  }
`;

export const CANCEL_RECURRING_GROUP = gql`
  mutation CancelRecurringGroup($groupId: ID!, $futureOnly: Boolean) {
    cancelRecurringGroup(groupId: $groupId, futureOnly: $futureOnly)
  }
`;
