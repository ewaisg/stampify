import type { ReactNode } from "react";
import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToastVariant = "default" | "destructive";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  action?: ReactNode;
  open?: boolean;
}

export interface ToastState {
  toasts: Toast[];
}

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------

const ACTION_ADD = "ADD_TOAST" as const;
const ACTION_UPDATE = "UPDATE_TOAST" as const;
const ACTION_DISMISS = "DISMISS_TOAST" as const;
const ACTION_REMOVE = "REMOVE_TOAST" as const;

type Action =
  | { type: typeof ACTION_ADD; toast: Toast }
  | { type: typeof ACTION_UPDATE; toast: Partial<Toast> & Pick<Toast, "id"> }
  | { type: typeof ACTION_DISMISS; toastId?: string }
  | { type: typeof ACTION_REMOVE; toastId?: string };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOAST_LIMIT = 5;
const TOAST_REMOVE_DELAY = 1_000;

// ---------------------------------------------------------------------------
// Internal state — shared across all consumers so `toast()` works outside
// React components (e.g. in event handlers or async callbacks).
// ---------------------------------------------------------------------------

let count = 0;

function genId(): string {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

function addToRemoveQueue(toastId: string) {
  if (toastTimeouts.has(toastId)) return;

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId);
    dispatch({ type: ACTION_REMOVE, toastId });
  }, TOAST_REMOVE_DELAY);

  toastTimeouts.set(toastId, timeout);
}

function reducer(state: ToastState, action: Action): ToastState {
  switch (action.type) {
    case ACTION_ADD:
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      };

    case ACTION_UPDATE:
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t,
        ),
      };

    case ACTION_DISMISS: {
      const { toastId } = action;

      if (toastId) {
        addToRemoveQueue(toastId);
      } else {
        state.toasts.forEach((t) => addToRemoveQueue(t.id));
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? { ...t, open: false }
            : t,
        ),
      };
    }

    case ACTION_REMOVE:
      if (action.toastId === undefined) {
        return { ...state, toasts: [] };
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Listeners — allow multiple `useToast` instances to stay in sync.
// ---------------------------------------------------------------------------

const listeners: Array<(state: ToastState) => void> = [];
let memoryState: ToastState = { toasts: [] };

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action);
  listeners.forEach((listener) => listener(memoryState));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ToastInput = Omit<Toast, "id">;

/**
 * Imperatively create a toast from anywhere in the app.
 * Returns helpers to update or dismiss that specific toast.
 */
export function toast(props: ToastInput) {
  const id = genId();

  const update = (updateProps: Partial<ToastInput>) =>
    dispatch({ type: ACTION_UPDATE, toast: { ...updateProps, id } });

  const dismiss = () => dispatch({ type: ACTION_DISMISS, toastId: id });

  dispatch({
    type: ACTION_ADD,
    toast: { ...props, id, open: true },
  });

  return { id, dismiss, update };
}

/**
 * React hook that subscribes to the shared toast state.
 */
export function useToast() {
  const [state, setState] = useState<ToastState>(memoryState);

  useEffect(() => {
    listeners.push(setState);
    return () => {
      const idx = listeners.indexOf(setState);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }, []);

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) =>
      dispatch({ type: ACTION_DISMISS, toastId }),
  };
}
