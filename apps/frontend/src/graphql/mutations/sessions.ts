import { gql } from '@apollo/client';

export const CREATE_SESSION = gql`
  mutation CreateSession($input: CreateSessionInput!) {
    createSession(input: $input) {
      id
      arenaId
      startTime
      endTime
      playerName
      comment
      status
      createdAt
      updatedAt
    }
  }
`;
export const UPDATE_SESSION = gql`
  mutation UpdateSession($input: UpdateSessionInput!) {
    updateSession(input: $input) {
      id
      arenaId
      startTime
      endTime
      playerName
      comment
      status
      createdAt
      updatedAt
    }
  }
`;
export const DELETE_SESSION = gql`
  mutation DeleteSession($id: ID!) {
    deleteSession(id: $id)
  }
`;
