"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/contexts/AuthContext";
import { FirebaseError } from "firebase/app";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function getFirebaseErrorMessage(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Invalid email or password";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    default:
      return "An unexpected error occurred. Please try again.";
  }
}

export default function LoginForm() {
  const { login, resetPassword } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setFormError(null);
    setResetSent(false);

    try {
      await login(data.email, data.password);
    } catch (error) {
      if (error instanceof FirebaseError) {
        setFormError(getFirebaseErrorMessage(error.code));
      } else {
        setFormError("An unexpected error occurred. Please try again.");
      }
    }
  };

  const handleForgotPassword = async () => {
    const email = getValues("email");
    if (!email) {
      setFormError("Please enter your email address first.");
      return;
    }

    setFormError(null);
    setResettingPassword(true);

    try {
      await resetPassword(email);
      setResetSent(true);
    } catch (error) {
      if (error instanceof FirebaseError) {
        setFormError(getFirebaseErrorMessage(error.code));
      } else {
        setFormError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setResettingPassword(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label
          htmlFor="email"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          {...register("email")}
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="password"
          className="mb-1 block text-sm font-medium text-foreground"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          {...register("password")}
        />
        {errors.password && (
          <p className="mt-1 text-sm text-red-500">
            {errors.password.message}
          </p>
        )}
      </div>

      {formError && (
        <p className="text-sm text-red-500">{formError}</p>
      )}

      {resetSent && (
        <p className="text-sm text-green-600">
          Password reset email sent. Check your inbox.
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-primary text-primary-foreground rounded-md px-4 py-2 font-medium hover:bg-primary/90 disabled:opacity-50 w-full"
      >
        {isSubmitting ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="h-4 w-4 animate-spin"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Signing in...
          </span>
        ) : (
          "Sign in"
        )}
      </button>

      <div className="text-center">
        <button
          type="button"
          onClick={handleForgotPassword}
          disabled={resettingPassword}
          className="text-sm text-primary hover:underline disabled:opacity-50"
        >
          {resettingPassword ? "Sending..." : "Forgot password?"}
        </button>
      </div>
    </form>
  );
}
