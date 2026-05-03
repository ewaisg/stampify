import { create } from "zustand";
import type { FileMetadata } from "@/types/stampify";

// ---------------------------------------------------------------------------
// State & Actions
// ---------------------------------------------------------------------------

interface FilesState {
  files: FileMetadata[];
  activeFileId: string | null;
  selectedFileIds: Set<string>;
  loading: boolean;
}

interface FilesActions {
  setFiles: (files: FileMetadata[]) => void;
  addFiles: (files: FileMetadata[]) => void;
  removeFile: (id: string) => void;
  removeFiles: (ids: string[]) => void;
  setActiveFile: (id: string | null) => void;
  toggleFileSelection: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  clearFiles: () => void;
  setLoading: (loading: boolean) => void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialState: FilesState = {
  files: [],
  activeFileId: null,
  selectedFileIds: new Set<string>(),
  loading: false,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useFilesStore = create<FilesState & FilesActions>()((set) => ({
  ...initialState,

  setFiles: (files) => set({ files }),

  addFiles: (newFiles) =>
    set((state) => ({ files: [...state.files, ...newFiles] })),

  removeFile: (id) =>
    set((state) => {
      const files = state.files.filter((f) => f.id !== id);
      const selectedFileIds = new Set(state.selectedFileIds);
      selectedFileIds.delete(id);
      const activeFileId = state.activeFileId === id ? null : state.activeFileId;
      return { files, selectedFileIds, activeFileId };
    }),

  removeFiles: (ids) =>
    set((state) => {
      const idsSet = new Set(ids);
      const files = state.files.filter((f) => !idsSet.has(f.id));
      const selectedFileIds = new Set(state.selectedFileIds);
      ids.forEach((id) => selectedFileIds.delete(id));
      const activeFileId =
        state.activeFileId && idsSet.has(state.activeFileId)
          ? null
          : state.activeFileId;
      return { files, selectedFileIds, activeFileId };
    }),

  setActiveFile: (id) => set({ activeFileId: id }),

  toggleFileSelection: (id) =>
    set((state) => {
      const selectedFileIds = new Set(state.selectedFileIds);
      if (selectedFileIds.has(id)) {
        selectedFileIds.delete(id);
      } else {
        selectedFileIds.add(id);
      }
      return { selectedFileIds };
    }),

  selectAll: () =>
    set((state) => ({
      selectedFileIds: new Set(state.files.map((f) => f.id)),
    })),

  deselectAll: () => set({ selectedFileIds: new Set<string>() }),

  clearFiles: () =>
    set({
      files: [],
      activeFileId: null,
      selectedFileIds: new Set<string>(),
    }),

  setLoading: (loading) => set({ loading }),
}));

// ---------------------------------------------------------------------------
// Selectors (computed values)
// ---------------------------------------------------------------------------

export const selectActiveFile = (state: FilesState): FileMetadata | undefined =>
  state.files.find((f) => f.id === state.activeFileId);

export const selectSelectedFiles = (state: FilesState): FileMetadata[] =>
  state.files.filter((f) => state.selectedFileIds.has(f.id));

export const selectHasFiles = (state: FilesState): boolean =>
  state.files.length > 0;
