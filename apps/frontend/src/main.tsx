import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApolloProvider } from '@apollo/client';
import { Toaster } from 'sonner';
import { apolloClient } from './graphql/client.js';
import { AuthProvider } from './contexts/auth-context.js';
import App from './app.js';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ApolloProvider client={apolloClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ApolloProvider>
    <Toaster position="top-right" richColors />
  </React.StrictMode>,
);
