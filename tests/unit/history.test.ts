import { describe, it, expect, beforeEach } from "vitest";
import { useHistoryStore, selectCanUndo, selectCanRedo } from "@/stores/history";
import { useAppliedStampsStore } from "@/stores/applied-stamps";
import { UNDO_STACK_SIZE } from "@/config";
import type { AppliedStamp } from "@/types/stampify";
import type { HistoryAction } from "@/stores/history";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Adds an applied stamp to the store and returns it along with the action. */
function addStamp(
  fileId = "file1",
  page = 1,
): { stamp: AppliedStamp; action: HistoryAction } {
  const stamp = useAppliedStampsStore.getState().addAppliedStamp(fileId, page, {
    stampId: "s1",
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    baseWidth: 100,
    baseHeight: 50,
    rotation: 0,
  });

  const action: HistoryAction = { type: "add", fileId, page, stamp };
  useHistoryStore.getState().pushAction(action);
  return { stamp, action };
}

function getStampsOnPage(fileId: string, page: number): AppliedStamp[] {
  return (
    useAppliedStampsStore.getState().appliedStamps.get(fileId)?.get(page) ?? []
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useHistoryStore", () => {
  beforeEach(() => {
    useHistoryStore.getState().clear();
    useAppliedStampsStore.getState().reset();
  });

  // ---- pushAction --------------------------------------------------------

  it("pushAction adds to undo stack", () => {
    const { action } = addStamp();

    const state = useHistoryStore.getState();
    expect(state.undoStack).toHaveLength(1);
    expect(state.undoStack[0]).toEqual(action);
  });

  it("pushAction clears redo stack", () => {
    // Add, then undo to populate the redo stack
    addStamp();
    useHistoryStore.getState().undo();
    expect(useHistoryStore.getState().redoStack).toHaveLength(1);

    // A new push should clear redo
    addStamp();
    expect(useHistoryStore.getState().redoStack).toHaveLength(0);
  });

  // ---- undo --------------------------------------------------------------

  it("undo moves action to redo stack", () => {
    addStamp();
    useHistoryStore.getState().undo();

    const state = useHistoryStore.getState();
    expect(state.undoStack).toHaveLength(0);
    expect(state.redoStack).toHaveLength(1);
  });

  it("undo of 'add' deletes the stamp from applied stamps", () => {
    const { stamp } = addStamp("file1", 1);
    expect(getStampsOnPage("file1", 1)).toHaveLength(1);

    useHistoryStore.getState().undo();
    // The stamp should no longer exist on that page
    const remaining = getStampsOnPage("file1", 1);
    expect(remaining.find((s) => s.id === stamp.id)).toBeUndefined();
  });

  it("undo does nothing when undo stack is empty", () => {
    useHistoryStore.getState().undo();
    const state = useHistoryStore.getState();
    expect(state.undoStack).toHaveLength(0);
    expect(state.redoStack).toHaveLength(0);
  });

  // ---- redo --------------------------------------------------------------

  it("redo moves action back to undo stack", () => {
    addStamp();
    useHistoryStore.getState().undo();
    useHistoryStore.getState().redo();

    const state = useHistoryStore.getState();
    expect(state.undoStack).toHaveLength(1);
    expect(state.redoStack).toHaveLength(0);
  });

  it("redo of 'add' re-adds the stamp to applied stamps", () => {
    const { stamp } = addStamp("file1", 1);
    useHistoryStore.getState().undo();
    expect(getStampsOnPage("file1", 1)).toHaveLength(0);

    useHistoryStore.getState().redo();
    const restored = getStampsOnPage("file1", 1);
    expect(restored).toHaveLength(1);
    expect(restored[0].id).toBe(stamp.id);
  });

  it("redo does nothing when redo stack is empty", () => {
    addStamp();
    useHistoryStore.getState().redo();

    const state = useHistoryStore.getState();
    expect(state.undoStack).toHaveLength(1);
    expect(state.redoStack).toHaveLength(0);
  });

  // ---- clear -------------------------------------------------------------

  it("clear resets both stacks", () => {
    addStamp();
    addStamp();
    useHistoryStore.getState().undo();

    useHistoryStore.getState().clear();

    const state = useHistoryStore.getState();
    expect(state.undoStack).toHaveLength(0);
    expect(state.redoStack).toHaveLength(0);
  });

  // ---- max size ----------------------------------------------------------

  it("undo stack respects UNDO_STACK_SIZE", () => {
    for (let i = 0; i < UNDO_STACK_SIZE + 5; i++) {
      addStamp("file1", 1);
    }

    expect(useHistoryStore.getState().undoStack).toHaveLength(UNDO_STACK_SIZE);
  });

  // ---- selectors ---------------------------------------------------------

  it("selectCanUndo returns true when undo stack is non-empty", () => {
    expect(selectCanUndo(useHistoryStore.getState())).toBe(false);

    addStamp();
    expect(selectCanUndo(useHistoryStore.getState())).toBe(true);
  });

  it("selectCanRedo returns true when redo stack is non-empty", () => {
    expect(selectCanRedo(useHistoryStore.getState())).toBe(false);

    addStamp();
    useHistoryStore.getState().undo();
    expect(selectCanRedo(useHistoryStore.getState())).toBe(true);
  });

  // ---- move action -------------------------------------------------------

  it("undo/redo of 'move' restores original position", () => {
    const { stamp } = addStamp("file1", 1);

    // Simulate a move
    useAppliedStampsStore.getState().updateAppliedStamp("file1", 1, {
      ...stamp,
      x: 50,
      y: 60,
    });

    const moveAction: HistoryAction = {
      type: "move",
      fileId: "file1",
      page: 1,
      stampId: stamp.id,
      from: { x: 10, y: 20 },
      to: { x: 50, y: 60 },
    };
    useHistoryStore.getState().pushAction(moveAction);

    // Undo the move
    useHistoryStore.getState().undo();
    const afterUndo = getStampsOnPage("file1", 1).find(
      (s) => s.id === stamp.id,
    )!;
    expect(afterUndo.x).toBe(10);
    expect(afterUndo.y).toBe(20);

    // Redo the move
    useHistoryStore.getState().redo();
    const afterRedo = getStampsOnPage("file1", 1).find(
      (s) => s.id === stamp.id,
    )!;
    expect(afterRedo.x).toBe(50);
    expect(afterRedo.y).toBe(60);
  });
});
