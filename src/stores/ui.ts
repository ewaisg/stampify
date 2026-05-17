import { create } from "zustand";

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

interface UIState {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  workspaceView: "dashboard" | "stamping";
  theme: "light" | "dark" | "system";
  zoom: number;
  currentPage: number;
  totalPages: number;
  selectedStampId: string | null;
}

interface UIActions {
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setWorkspaceView: (view: "dashboard" | "stamping") => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setZoom: (zoom: number) => void;
  setCurrentPage: (page: number) => void;
  setTotalPages: (pages: number) => void;
  setSelectedStampId: (id: string | null) => void;
  resetView: () => void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: UIState = {
  leftPanelOpen: true,
  rightPanelOpen: true,
  workspaceView: "dashboard",
  theme: "system",
  zoom: 1,
  currentPage: 1,
  totalPages: 0,
  selectedStampId: null,
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

  setWorkspaceView: (view) => set({ workspaceView: view }),

  setTheme: (theme) => set({ theme }),

  setZoom: (zoom) => set({ zoom }),

  setCurrentPage: (page) => set({ currentPage: page }),

  setTotalPages: (pages) => set({ totalPages: pages }),

  setSelectedStampId: (id) => set({ selectedStampId: id }),

  resetView: () =>
    set({
      zoom: initialState.zoom,
      currentPage: initialState.currentPage,
    }),
}));
