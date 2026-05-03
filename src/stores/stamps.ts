import { create } from "zustand";
import type { Stamp, NewStamp } from "@/types/stampify";

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

interface StampsState {
  stamps: Stamp[];
  loading: boolean;
  error: string | null;
}

interface StampsActions {
  setStamps: (stamps: Stamp[]) => void;
  addStamp: (newStamp: NewStamp) => string;
  updateStamp: (id: string, patch: Partial<Stamp>) => void;
  deleteStamp: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: StampsState = {
  stamps: [],
  loading: false,
  error: null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useStampsStore = create<StampsState & StampsActions>()((set) => ({
  ...initialState,

  setStamps: (stamps) => set({ stamps }),

  addStamp: (newStamp) => {
    const id = crypto.randomUUID();
    const stamp = { ...newStamp, id } as Stamp;
    set((state) => ({ stamps: [...state.stamps, stamp] }));
    return id;
  },

  updateStamp: (id, patch) =>
    set((state) => ({
      stamps: state.stamps.map((s) =>
        s.id === id ? ({ ...s, ...patch } as Stamp) : s,
      ),
    })),

  deleteStamp: (id) =>
    set((state) => ({
      stamps: state.stamps.filter((s) => s.id !== id),
    })),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error }),

  reset: () => set(initialState),
}));
