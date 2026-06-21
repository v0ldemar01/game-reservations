import { ApolloProvider } from '@apollo/client';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'sonner';

import App from './app.js';
import { AuthProvider } from './contexts/auth-context.js';
import { apolloClient } from './graphql/client.js';
import './index.css';

ReactDOM.createRoot(document.querySelector('#root') as HTMLElement).render(
  <React.StrictMode>
    <ApolloProvider client={apolloClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ApolloProvider>
    <Toaster position="top-right" richColors />
  </React.StrictMode>
);
