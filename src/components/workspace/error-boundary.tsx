"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback to render instead of the default error card. */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ---------------------------------------------------------------------------
// Class component
// ---------------------------------------------------------------------------

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log to the console in every environment; a production logger could be
    // plugged in here later.
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    const isDev = process.env.NODE_ENV === "development";

    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <Card className="w-full max-w-md text-center">
          <CardHeader className="items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="mt-4">Something went wrong</CardTitle>
          </CardHeader>
          <CardContent>
            {isDev && this.state.error && (
              <p className="break-words text-sm text-muted-foreground">
                {this.state.error.message}
              </p>
            )}
          </CardContent>
          <CardFooter className="justify-center">
            <Button onClick={this.handleReset}>Try Again</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }
}

// ---------------------------------------------------------------------------
// HOC wrapper — useful for wrapping individual route segments or components
// ---------------------------------------------------------------------------

export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode,
) {
  const displayName =
    WrappedComponent.displayName || WrappedComponent.name || "Component";

  const Wrapper = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  Wrapper.displayName = `withErrorBoundary(${displayName})`;
  return Wrapper;
}
