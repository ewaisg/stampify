import { create } from "zustand";
import { useAppliedStampsStore } from "@/stores/applied-stamps";
import { UNDO_STACK_SIZE } from "@/config";
import type { AppliedStamp } from "@/types/stampify";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HistoryAction =
  | { type: "add"; fileId: string; page: number; stamp: AppliedStamp }
  | { type: "delete"; fileId: string; page: number; stamp: AppliedStamp }
  | {
      type: "move";
      fileId: string;
      page: number;
      stampId: string;
      from: { x: number; y: number };
      to: { x: number; y: number };
    }
  | {
      type: "resize";
      fileId: string;
      page: number;
      stampId: string;
      from: { width: number; height: number; x: number; y: number };
      to: { width: number; height: number; x: number; y: number };
    }
  | {
      type: "duplicate_all";
      fileId: string;
      stampIds: { page: number; id: string }[];
      /** Full stamp snapshots stored internally so redo can re-add them. */
      _stamps?: AppliedStamp[];
    };

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

interface HistoryState {
  undoStack: HistoryAction[];
  redoStack: HistoryAction[];
}

interface HistoryActions {
  pushAction: (action: HistoryAction) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
}

// ---------------------------------------------------------------------------
// Helpers — apply an action forward or in reverse
// ---------------------------------------------------------------------------

function applyForward(action: HistoryAction): void {
  const stamps = useAppliedStampsStore.getState();

  switch (action.type) {
    case "add": {
      stamps.addAppliedStampWithId(action.fileId, action.page, action.stamp);
      break;
    }
    case "delete": {
      stamps.deleteAppliedStamp(action.fileId, action.page, action.stamp.id);
      break;
    }
    case "move": {
      const pageStamps = stamps.appliedStamps
        .get(action.fileId)
        ?.get(action.page);
      const target = pageStamps?.find((s) => s.id === action.stampId);
      if (target) {
        stamps.updateAppliedStamp(action.fileId, action.page, {
          ...target,
          x: action.to.x,
          y: action.to.y,
        });
      }
      break;
    }
    case "resize": {
      const pageStamps = stamps.appliedStamps
        .get(action.fileId)
        ?.get(action.page);
      const target = pageStamps?.find((s) => s.id === action.stampId);
      if (target) {
        stamps.updateAppliedStamp(action.fileId, action.page, {
          ...target,
          width: action.to.width,
          height: action.to.height,
          x: action.to.x,
          y: action.to.y,
        });
      }
      break;
    }
    case "duplicate_all": {
      // Re-add all stamps that were captured during undo
      if (action._stamps) {
        for (const stamp of action._stamps) {
          stamps.addAppliedStampWithId(action.fileId, stamp.page, stamp);
        }
      }
      break;
    }
  }
}

function applyReverse(action: HistoryAction): void {
  const stamps = useAppliedStampsStore.getState();

  switch (action.type) {
    case "add": {
      // Reverse of add → delete
      stamps.deleteAppliedStamp(action.fileId, action.page, action.stamp.id);
      break;
    }
    case "delete": {
      // Reverse of delete → re-add with original id
      stamps.addAppliedStampWithId(action.fileId, action.page, action.stamp);
      break;
    }
    case "move": {
      const pageStamps = stamps.appliedStamps
        .get(action.fileId)
        ?.get(action.page);
      const target = pageStamps?.find((s) => s.id === action.stampId);
      if (target) {
        stamps.updateAppliedStamp(action.fileId, action.page, {
          ...target,
          x: action.from.x,
          y: action.from.y,
        });
      }
      break;
    }
    case "resize": {
      const pageStamps = stamps.appliedStamps
        .get(action.fileId)
        ?.get(action.page);
      const target = pageStamps?.find((s) => s.id === action.stampId);
      if (target) {
        stamps.updateAppliedStamp(action.fileId, action.page, {
          ...target,
          width: action.from.width,
          height: action.from.height,
          x: action.from.x,
          y: action.from.y,
        });
      }
      break;
    }
    case "duplicate_all": {
      // Snapshot full stamp data before deleting so redo can re-add them
      const snapshots: AppliedStamp[] = [];
      for (const { page, id } of action.stampIds) {
        const pageStamps = stamps.appliedStamps
          .get(action.fileId)
          ?.get(page);
        const found = pageStamps?.find((s) => s.id === id);
        if (found) snapshots.push(found);
      }
      // Mutate the action in-place so the redo path has access to full data
      action._stamps = snapshots;

      // Reverse of duplicate_all → delete all the listed stamps
      for (const { page, id } of action.stampIds) {
        // Re-read state each iteration since deleteAppliedStamp mutates it
        useAppliedStampsStore.getState().deleteAppliedStamp(action.fileId, page, id);
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: HistoryState = {
  undoStack: [],
  redoStack: [],
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useHistoryStore = create<HistoryState & HistoryActions>()(
  (set, get) => ({
    ...initialState,

    pushAction: (action) =>
      set((state) => ({
        undoStack: [...state.undoStack, action].slice(-UNDO_STACK_SIZE),
        redoStack: [],
      })),

    undo: () => {
      const { undoStack, redoStack } = get();
      if (undoStack.length === 0) return;

      const action = undoStack[undoStack.length - 1];
      applyReverse(action);

      set({
        undoStack: undoStack.slice(0, -1),
        redoStack: [...redoStack, action],
      });
    },

    redo: () => {
      const { undoStack, redoStack } = get();
      if (redoStack.length === 0) return;

      const action = redoStack[redoStack.length - 1];
      applyForward(action);

      set({
        undoStack: [...undoStack, action].slice(-UNDO_STACK_SIZE),
        redoStack: redoStack.slice(0, -1),
      });
    },

    clear: () => set({ undoStack: [], redoStack: [] }),
  }),
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectCanUndo = (state: HistoryState): boolean =>
  state.undoStack.length > 0;

export const selectCanRedo = (state: HistoryState): boolean =>
  state.redoStack.length > 0;
