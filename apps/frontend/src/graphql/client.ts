import { ApolloClient, from, HttpLink, InMemoryCache } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const TOKEN_KEY = 'game_reservations_token';

const authLink = setContext(
  (_, previousContext: { headers?: Record<string, string> }) => {
    const { headers } = previousContext;
    const token = localStorage.getItem(TOKEN_KEY);

    return {
      headers: {
        ...headers,
        ...(token ? { authorization: `Bearer ${token}` } : {})
      }
    };
  }
);

const httpLink = new HttpLink({
  uri: import.meta.env.VITE_GRAPHQL_URL ?? '/graphql'
});

export const apolloClient = new ApolloClient({
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: 'cache-and-network' }
  },
  link: from([authLink, httpLink])
});
