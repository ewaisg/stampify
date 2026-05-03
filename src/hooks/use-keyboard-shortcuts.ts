"use client";

import { useEffect } from "react";
import { useUIStore } from "@/stores/ui";
import { useFilesStore } from "@/stores/files";
import { useHistoryStore } from "@/stores/history";
import { MIN_ZOOM, MAX_ZOOM, ZOOM_INCREMENT } from "@/config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UseKeyboardShortcutsParams {
  /** ID of the currently selected applied stamp (null if none). */
  selectedStampId: string | null;
  /** Active file ID (empty string if none). */
  fileId: string;
  /** Current page number. */
  currentPage: number;
  /** Total page count for the active document. */
  totalPages: number;
  /** Callback to delete the selected stamp. */
  deleteStamp: () => void;
  /** Callback to deselect the current stamp. */
  deselectStamp: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true when the active element is an interactive text field. */
function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Registers global keyboard shortcuts for the workspace.
 *
 * - `Delete` / `Backspace` — delete the selected applied stamp
 * - `Escape` — deselect current stamp
 * - `+` / `=` — zoom in
 * - `-` — zoom out
 * - `ArrowLeft` — previous page
 * - `ArrowRight` — next page
 * - `Ctrl+A` / `Cmd+A` — select all files (dispatched via the files store)
 * - `Ctrl+Z` / `Cmd+Z` — undo last stamp operation
 * - `Ctrl+Y` / `Cmd+Y` / `Ctrl+Shift+Z` / `Cmd+Shift+Z` — redo
 *
 * All shortcuts are suppressed when focus is in an input, textarea, or select.
 */
export function useKeyboardShortcuts({
  selectedStampId,
  fileId,
  currentPage,
  totalPages,
  deleteStamp,
  deselectStamp,
}: UseKeyboardShortcutsParams): void {
  useEffect(() => {
    const setZoom = useUIStore.getState().setZoom;
    const setCurrentPage = useUIStore.getState().setCurrentPage;

    const handler = (e: KeyboardEvent) => {
      // Never intercept when the user is typing in an editable field
      if (isEditableElement(document.activeElement)) return;

      switch (e.key) {
        // -----------------------------------------------------------------
        // Delete selected stamp
        // -----------------------------------------------------------------
        case "Delete":
        case "Backspace": {
          if (selectedStampId && fileId) {
            e.preventDefault();
            deleteStamp();
          }
          break;
        }

        // -----------------------------------------------------------------
        // Deselect
        // -----------------------------------------------------------------
        case "Escape": {
          e.preventDefault();
          deselectStamp();
          break;
        }

        // -----------------------------------------------------------------
        // Zoom in
        // -----------------------------------------------------------------
        case "+":
        case "=": {
          e.preventDefault();
          const currentZoom = useUIStore.getState().zoom;
          setZoom(Math.min(MAX_ZOOM, currentZoom + ZOOM_INCREMENT));
          break;
        }

        // -----------------------------------------------------------------
        // Zoom out
        // -----------------------------------------------------------------
        case "-": {
          e.preventDefault();
          const currentZoom = useUIStore.getState().zoom;
          setZoom(Math.max(MIN_ZOOM, currentZoom - ZOOM_INCREMENT));
          break;
        }

        // -----------------------------------------------------------------
        // Previous page
        // -----------------------------------------------------------------
        case "ArrowLeft": {
          if (currentPage > 1) {
            e.preventDefault();
            setCurrentPage(currentPage - 1);
          }
          break;
        }

        // -----------------------------------------------------------------
        // Next page
        // -----------------------------------------------------------------
        case "ArrowRight": {
          if (currentPage < totalPages) {
            e.preventDefault();
            setCurrentPage(currentPage + 1);
          }
          break;
        }

        // -----------------------------------------------------------------
        // Select all files (Ctrl+A / Cmd+A)
        // -----------------------------------------------------------------
        case "a":
        case "A": {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            useFilesStore.getState().selectAll();
          }
          break;
        }

        // -----------------------------------------------------------------
        // Undo (Ctrl+Z / Cmd+Z)
        // -----------------------------------------------------------------
        case "z":
        case "Z": {
          if (e.ctrlKey || e.metaKey) {
            if (e.shiftKey) {
              // Ctrl+Shift+Z → redo
              e.preventDefault();
              useHistoryStore.getState().redo();
            } else {
              // Ctrl+Z → undo
              e.preventDefault();
              useHistoryStore.getState().undo();
            }
          }
          break;
        }

        // -----------------------------------------------------------------
        // Redo (Ctrl+Y / Cmd+Y)
        // -----------------------------------------------------------------
        case "y":
        case "Y": {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            useHistoryStore.getState().redo();
          }
          break;
        }

        default:
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    selectedStampId,
    fileId,
    currentPage,
    totalPages,
    deleteStamp,
    deselectStamp,
  ]);
}
