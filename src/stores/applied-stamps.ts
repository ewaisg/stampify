import { create } from "zustand";
import type { AppliedStamp } from "@/types/stampify";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Nested Map structure:  fileId -> pageNumber -> AppliedStamp[]
 *
 * We use Maps directly because the store is not persisted to localStorage;
 * syncing to Firestore is handled in a separate service layer.
 */
type PageStampsMap = Map<number, AppliedStamp[]>;
type FileStampsMap = Map<string, PageStampsMap>;

interface AppliedStampsState {
  appliedStamps: FileStampsMap;
}

interface AppliedStampsActions {
  addAppliedStamp: (
    fileId: string,
    page: number,
    stamp: Omit<AppliedStamp, "id" | "page">,
  ) => AppliedStamp;
  /** Insert a stamp with a pre-existing id (used by undo/redo restore). */
  addAppliedStampWithId: (
    fileId: string,
    page: number,
    stamp: AppliedStamp,
  ) => void;
  updateAppliedStamp: (
    fileId: string,
    page: number,
    stamp: AppliedStamp,
  ) => void;
  deleteAppliedStamp: (
    fileId: string,
    page: number,
    stampId: string,
  ) => void;
  duplicateToAllPages: (
    fileId: string,
    baseStamp: AppliedStamp,
    totalPages: number,
  ) => void;
  /** Replace all applied stamps for a file from a flat array (used by Firestore sync). */
  setFileStamps: (fileId: string, stamps: AppliedStamp[]) => void;
  clearFile: (fileId: string) => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Deep-clone the outer Map so Zustand detects a new reference. */
function cloneFileMap(map: FileStampsMap): FileStampsMap {
  const next = new Map<string, PageStampsMap>();
  for (const [fileId, pageMap] of map) {
    next.set(fileId, new Map(pageMap));
  }
  return next;
}

/** Ensure the nested path exists and return the page-level array. */
function ensurePage(
  map: FileStampsMap,
  fileId: string,
  page: number,
): AppliedStamp[] {
  let pageMap = map.get(fileId);
  if (!pageMap) {
    pageMap = new Map<number, AppliedStamp[]>();
    map.set(fileId, pageMap);
  }
  let stamps = pageMap.get(page);
  if (!stamps) {
    stamps = [];
    pageMap.set(page, stamps);
  }
  return stamps;
}

/**
 * Normalize dimensions so that baseWidth / baseHeight are always stored,
 * falling back to the current width / height when absent.
 */
function normalizeBase(
  stamp: Omit<AppliedStamp, "id" | "page"> & Partial<Pick<AppliedStamp, "baseWidth" | "baseHeight">>,
): { baseWidth: number; baseHeight: number } {
  return {
    baseWidth: stamp.baseWidth ?? stamp.width,
    baseHeight: stamp.baseHeight ?? stamp.height,
  };
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: AppliedStampsState = {
  appliedStamps: new Map<string, PageStampsMap>(),
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAppliedStampsStore = create<
  AppliedStampsState & AppliedStampsActions
>()((set) => ({
  ...initialState,

  addAppliedStamp: (fileId, page, stamp) => {
    const id = crypto.randomUUID();
    const { baseWidth, baseHeight } = normalizeBase(stamp);

    const created: AppliedStamp = {
      ...stamp,
      id,
      page,
      baseWidth,
      baseHeight,
    };

    set((state) => {
      const next = cloneFileMap(state.appliedStamps);
      const arr = ensurePage(next, fileId, page);
      arr.push(created);
      // Replace the array reference so downstream selectors pick up the change.
      next.get(fileId)!.set(page, [...arr]);
      return { appliedStamps: next };
    });

    return created;
  },

  addAppliedStampWithId: (fileId, page, stamp) =>
    set((state) => {
      const next = cloneFileMap(state.appliedStamps);
      const arr = ensurePage(next, fileId, page);
      const { baseWidth, baseHeight } = normalizeBase(stamp);
      const restored: AppliedStamp = { ...stamp, baseWidth, baseHeight };
      arr.push(restored);
      next.get(fileId)!.set(page, [...arr]);
      return { appliedStamps: next };
    }),

  updateAppliedStamp: (fileId, page, stamp) =>
    set((state) => {
      const next = cloneFileMap(state.appliedStamps);
      const pageMap = next.get(fileId);
      if (!pageMap) return state;

      const arr = pageMap.get(page);
      if (!arr) return state;

      const { baseWidth, baseHeight } = normalizeBase(stamp);
      const updated: AppliedStamp = { ...stamp, baseWidth, baseHeight };

      pageMap.set(
        page,
        arr.map((s) => (s.id === stamp.id ? updated : s)),
      );
      return { appliedStamps: next };
    }),

  deleteAppliedStamp: (fileId, page, stampId) =>
    set((state) => {
      const next = cloneFileMap(state.appliedStamps);
      const pageMap = next.get(fileId);
      if (!pageMap) return state;

      const arr = pageMap.get(page);
      if (!arr) return state;

      pageMap.set(
        page,
        arr.filter((s) => s.id !== stampId),
      );
      return { appliedStamps: next };
    }),

  duplicateToAllPages: (fileId, baseStamp, totalPages) =>
    set((state) => {
      const next = cloneFileMap(state.appliedStamps);

      for (let page = 1; page <= totalPages; page++) {
        if (page === baseStamp.page) continue;

        const arr = ensurePage(next, fileId, page);

        // Deduplicate: skip if a stamp with the same stampId already exists
        // at the same relative position on this page.
        const alreadyExists = arr.some(
          (s) =>
            s.stampId === baseStamp.stampId &&
            s.x === baseStamp.x &&
            s.y === baseStamp.y,
        );
        if (alreadyExists) continue;

        const { baseWidth, baseHeight } = normalizeBase(baseStamp);

        const duplicate: AppliedStamp = {
          ...baseStamp,
          id: crypto.randomUUID(),
          page,
          baseWidth,
          baseHeight,
          data: baseStamp.data ? { ...baseStamp.data } : undefined,
        };

        arr.push(duplicate);
        next.get(fileId)!.set(page, [...arr]);
      }

      return { appliedStamps: next };
    }),

  setFileStamps: (fileId, stamps) =>
    set((state) => {
      const next = cloneFileMap(state.appliedStamps);
      const pageMap = new Map<number, AppliedStamp[]>();

      for (const stamp of stamps) {
        let arr = pageMap.get(stamp.page);
        if (!arr) {
          arr = [];
          pageMap.set(stamp.page, arr);
        }
        arr.push(stamp);
      }

      next.set(fileId, pageMap);
      return { appliedStamps: next };
    }),

  clearFile: (fileId) =>
    set((state) => {
      const next = cloneFileMap(state.appliedStamps);
      next.delete(fileId);
      return { appliedStamps: next };
    }),

  reset: () => set({ appliedStamps: new Map<string, PageStampsMap>() }),
}));

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const selectStampsForPage = (
  state: AppliedStampsState,
  fileId: string,
  page: number,
): AppliedStamp[] => {
  return state.appliedStamps.get(fileId)?.get(page) ?? [];
};
