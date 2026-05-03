import type { Metadata } from "next";
import LoginForm from "@/components/workspace/login-form";

export const metadata: Metadata = {
  title: "Sign in | Stampify",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-card-foreground">
              Sign in to Stampify
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Enter your credentials to continue
            </p>
          </div>

          <LoginForm />
        </div>

        <div className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">
          <p>
            <strong className="text-card-foreground">Stampify</strong> lets you
            upload, view, and stamp PDFs with ease. Manage your documents and
            apply custom stamps in just a few clicks.
          </p>
        </div>
      </div>
    </div>
  );
}
