import { create } from "zustand";

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

interface UIState {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  theme: "light" | "dark" | "system";
  zoom: number;
  currentPage: number;
}

interface UIActions {
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setZoom: (zoom: number) => void;
  setCurrentPage: (page: number) => void;
  resetView: () => void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: UIState = {
  leftPanelOpen: true,
  rightPanelOpen: true,
  theme: "system",
  zoom: 1,
  currentPage: 1,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useUIStore = create<UIState & UIActions>()((set) => ({
  ...initialState,

  toggleLeftPanel: () =>
    set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),

  toggleRightPanel: () =>
    set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),

  setTheme: (theme) => set({ theme }),

  setZoom: (zoom) => set({ zoom }),

  setCurrentPage: (page) => set({ currentPage: page }),

  resetView: () =>
    set({
      zoom: initialState.zoom,
      currentPage: initialState.currentPage,
    }),
}));
