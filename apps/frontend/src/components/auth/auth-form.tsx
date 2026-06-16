import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation } from "@apollo/client";
import { useAuth } from "../../contexts/auth-context.js";
import { REGISTER, LOGIN } from "../../graphql/mutations/auth.js";
import { AuthPayload } from "../../types.js";
import { Button } from "../ui/button.js";
import { ErrorMessage } from "../ui/error-message.js";

interface AuthFormValues {
  email: string;
  password: string;
}

export function AuthForm() {
  const { setAuth } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AuthFormValues>();

  const [login, { loading: loginLoading }] = useMutation<{
    login: AuthPayload;
  }>(LOGIN);
  const [registerMutation, { loading: registerLoading }] = useMutation<{
    register: AuthPayload;
  }>(REGISTER);
  const loading = loginLoading || registerLoading;

  const switchMode = (next: "login" | "register") => {
    setMode(next);
    setServerError(null);
    reset();
  };

  const onSubmit = async (values: AuthFormValues) => {
    setServerError(null);
    try {
      if (mode === "login") {
        const result = await login({ variables: { input: values } });
        if (result.data) setAuth(result.data.login);
      } else {
        const result = await registerMutation({ variables: { input: values } });
        if (result.data) setAuth(result.data.register);
      }
    } catch (err: unknown) {
      const gqlErr = (err as { graphQLErrors?: Array<{ message: string }> })
        .graphQLErrors;
      setServerError(
        gqlErr?.[0]?.message ??
          "An unexpected error occurred. Please try again.",
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
            {mode === "login"
              ? "Sign in to your account"
              : "Create a new account"}
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              {...register("email", {
                required: "Email is required",
                pattern: {
                  value: /\S+@\S+\.\S+/,
                  message: "Invalid email address",
                },
              })}
            />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              placeholder={
                mode === "register" ? "At least 8 characters" : "••••••••"
              }
              className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              {...register("password", {
                required: "Password is required",
                ...(mode === "register" && {
                  minLength: {
                    value: 8,
                    message: "Password must be at least 8 characters",
                  },
                }),
              })}
            />
            {errors.password && (
              <p className="text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>

          {serverError && <ErrorMessage message={serverError} />}

          <Button
            type="submit"
            loading={loading}
            className="w-full justify-center"
          >
            {mode === "login" ? "Sign In" : "Create Account"}
          </Button>
        </form>

        <div className="mt-5 text-center text-sm text-gray-500">
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("register")}
                className="font-medium text-blue-600 hover:underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => switchMode("login")}
                className="font-medium text-blue-600 hover:underline"
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
