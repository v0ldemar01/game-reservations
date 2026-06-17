import { gql } from '@apollo/client';

export const GET_ARENAS = gql`
  query GetArenas($search: String) {
    arenas(search: $search) {
      id
      name
      createdAt
    }
  }
`;
export const GET_SESSIONS = gql`
  query GetSessions(
    $arenaId: ID!
    $dayStart: String!
    $dayEnd: String!
    $page: Int
    $pageSize: Int
  ) {
    sessions(
      arenaId: $arenaId
      dayStart: $dayStart
      dayEnd: $dayEnd
      page: $page
      pageSize: $pageSize
    ) {
      items {
        id
        arenaId
        startTime
        endTime
        playerName
        comment
        status
        recurringGroupId
        createdAt
        updatedAt
      }
      total
      page
      pageSize
    }
  }
`;
export const GET_ARENA_ANALYTICS = gql`
  query GetArenaAnalytics($arenaId: ID!, $from: String!, $to: String!) {
    arenaAnalytics(arenaId: $arenaId, from: $from, to: $to) {
      dailyUtilization {
        date
        bookedMinutes
        utilizationPercent
      }
      peakHours {
        hour
        count
      }
    }
  }
`;
export const GET_BUSIEST_ARENAS = gql`
  query GetBusiestArenas($from: String!, $to: String!, $limit: Int) {
    busiestArenas(from: $from, to: $to, limit: $limit) {
      arenaId
      arenaName
      totalBookedMinutes
      sessionCount
    }
  }
`;
export const MY_WAITLIST_ENTRIES = gql`
  query MyWaitlistEntries {
    myWaitlistEntries {
      id
      arenaId
      startTime
      endTime
      notifiedAt
      createdAt
    }
  }
`;
export const CHECK_AVAILABILITY = gql`
  query CheckAvailability($input: CheckAvailabilityInput!) {
    checkAvailability(input: $input) {
      available
      suggestedSlots {
        startTime
        endTime
      }
    }
  }
`;
