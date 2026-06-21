import { gql } from '@apollo/client';

export const JOIN_WAITLIST = gql`
  mutation JoinWaitlist($input: JoinWaitlistInput!) {
    joinWaitlist(input: $input) {
      id
      arenaId
      startTime
      endTime
      createdAt
    }
  }
`;
export const LEAVE_WAITLIST = gql`
  mutation LeaveWaitlist($id: ID!) {
    leaveWaitlist(id: $id)
  }
`;
