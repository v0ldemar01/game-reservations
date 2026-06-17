import { useMutation } from '@apollo/client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { useAuth } from '../../contexts/auth-context.js';
import { LOGIN, REGISTER } from '../../graphql/mutations/auth.js';
import { type AuthPayload } from '../../types.js';
import { Button } from '../ui/button.js';
import { ErrorMessage } from '../ui/error-message.js';

interface AuthFormValues {
  email: string;
  password: string;
}

export function AuthForm() {
  const { setAuth } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [serverError, setServerError] = useState<null | string>(null);

  const {
    formState: { errors },
    handleSubmit,
    register,
    reset
  } = useForm<AuthFormValues>();

  const [login, { loading: loginLoading }] = useMutation<{
    login: AuthPayload;
  }>(LOGIN);
  const [registerMutation, { loading: registerLoading }] = useMutation<{
    register: AuthPayload;
  }>(REGISTER);
  const loading = loginLoading || registerLoading;

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setServerError(null);
    reset();
  };

  const onSubmit = async (values: AuthFormValues) => {
    setServerError(null);

    try {
      if (mode === 'login') {
        const result = await login({ variables: { input: values } });

        if (result.data) {
          setAuth(result.data.login);
        }
      } else {
        const result = await registerMutation({ variables: { input: values } });

        if (result.data) {
          setAuth(result.data.register);
        }
      }
    } catch (error: unknown) {
      const gqlError = (error as { graphQLErrors?: Array<{ message: string }> })
        .graphQLErrors;
      setServerError(
        gqlError?.[0]?.message ??
          'An unexpected error occurred. Please try again.'
      );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm rounded-xl border bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Game Arena Reservations
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {mode === 'login'
              ? 'Sign in to your account'
              : 'Create a new account'}
          </p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-1.5">
            <label
              className="text-sm font-medium text-gray-700"
              htmlFor="email"
            >
              Email
            </label>
            <input
              autoComplete="email"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              id="email"
              placeholder="you@example.com"
              type="email"
              {...register('email', {
                required: 'Email is required',
                validate: (value) =>
                  isValidEmail(value) || 'Invalid email address'
              })}
            />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              className="text-sm font-medium text-gray-700"
              htmlFor="password"
            >
              Password
            </label>
            <input
              autoComplete={
                mode === 'login' ? 'current-password' : 'new-password'
              }
              className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              id="password"
              placeholder={
                mode === 'register' ? 'At least 8 characters' : '••••••••'
              }
              type="password"
              {...register('password', {
                required: 'Password is required',
                ...(mode === 'register' && {
                  minLength: {
                    message: 'Password must be at least 8 characters',
                    value: 8
                  }
                })
              })}
            />
            {errors.password && (
              <p className="text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>

          {serverError && <ErrorMessage message={serverError} />}

          <Button
            className="w-full justify-center"
            loading={loading}
            type="submit"
          >
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        <div className="mt-5 text-center text-sm text-gray-500">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button
                className="font-medium text-blue-600 hover:underline"
                onClick={() => {
                  switchMode('register');
                }}
                type="button"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                className="font-medium text-blue-600 hover:underline"
                onClick={() => {
                  switchMode('login');
                }}
                type="button"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function isValidEmail(value: string): boolean {
  const atIndex = value.indexOf('@');

  if (atIndex <= 0 || atIndex === value.length - 1) {
    return false;
  }

  const domain = value.slice(atIndex + 1);
  const dotIndex = domain.lastIndexOf('.');

  return dotIndex > 0 && dotIndex < domain.length - 1;
}
