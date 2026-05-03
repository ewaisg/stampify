"use client";

import * as React from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useToast, type Toast as ToastType } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Toast item
// ---------------------------------------------------------------------------

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  toast: ToastType;
  onDismiss: (id: string) => void;
}

function Toast({ toast, onDismiss, className, ...props }: ToastProps) {
  // Auto-dismiss after 5 seconds
  React.useEffect(() => {
    if (!toast.open) return;

    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 5000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.open, onDismiss]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      data-state={toast.open ? "open" : "closed"}
      className={cn(
        "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-4 pr-8 shadow-lg transition-all",
        "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-full",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-right-full",
        toast.variant === "destructive"
          ? "border-destructive bg-destructive text-destructive-foreground"
          : "border bg-background text-foreground",
        className,
      )}
      {...props}
    >
      <div className="grid gap-1">
        {toast.title && (
          <div className="text-sm font-semibold">{toast.title}</div>
        )}
        {toast.description && (
          <div className="text-sm opacity-90">{toast.description}</div>
        )}
      </div>

      {toast.action}

      <button
        type="button"
        className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100"
        onClick={() => onDismiss(toast.id)}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toaster — renders active toasts in a fixed container
// ---------------------------------------------------------------------------

function Toaster() {
  const { toasts, dismiss } = useToast();

  const handleDismiss = React.useCallback(
    (id: string) => {
      dismiss(id);
    },
    [dismiss],
  );

  return (
    <div className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-[420px]">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={handleDismiss} />
      ))}
    </div>
  );
}

export { Toast, Toaster };
