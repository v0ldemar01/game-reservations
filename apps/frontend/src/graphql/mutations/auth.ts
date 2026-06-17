import { gql } from '@apollo/client';

const USER_FRAGMENT = gql`
  fragment UserFields on UserModel {
    id
    email
    role
    createdAt
  }
`;

export const REGISTER = gql`
  ${USER_FRAGMENT}
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      token
      user {
        ...UserFields
      }
    }
  }
`;
export const LOGIN = gql`
  ${USER_FRAGMENT}
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
      user {
        ...UserFields
      }
    }
  }
`;
