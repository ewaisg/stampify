"use client";

import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  FileUp,
} from "lucide-react";
import { useUIStore } from "@/stores/ui";
import { useFilesStore, selectActiveFile } from "@/stores/files";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FilePanel } from "@/components/workspace/file-panel";
import { PdfCanvas } from "@/components/workspace/pdf-canvas";
import { StampPanel } from "@/components/stamps/stamp-panel";
import { Onboarding } from "@/components/workspace/onboarding";
import { useFirestoreSync } from "@/hooks/use-firestore-sync";
import { useAppliedStampsSync } from "@/hooks/use-applied-stamps-sync";
import { useAppliedStampActions } from "@/hooks/use-applied-stamp-actions";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { getFileBuffer } from "@/lib/pdf/file-manager";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addFileBuffer } from "@/lib/pdf/file-manager";

export default function WorkspacePage() {
  useFirestoreSync();

  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const toggleLeftPanel = useUIStore((s) => s.toggleLeftPanel);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);
  const currentPage = useUIStore((s) => s.currentPage);
  const totalPages = useUIStore((s) => s.totalPages);
  const selectedStampId = useUIStore((s) => s.selectedStampId);
  const setSelectedStampId = useUIStore((s) => s.setSelectedStampId);
  const activeFile = useFilesStore(selectActiveFile);
  const activeFileId = useFilesStore((s) => s.activeFileId);

  // Applied stamps Firestore sync & actions
  useAppliedStampsSync(activeFileId);
  const { deleteStamp: deleteAppliedStamp } = useAppliedStampActions();

  const fileId = activeFileId ?? "";

  const deleteStamp = useCallback(() => {
    if (!fileId || !selectedStampId) return;
    deleteAppliedStamp(fileId, currentPage, selectedStampId);
    setSelectedStampId(null);
  }, [fileId, selectedStampId, currentPage, deleteAppliedStamp, setSelectedStampId]);

  const deselectStamp = useCallback(() => {
    setSelectedStampId(null);
  }, [setSelectedStampId]);

  useKeyboardShortcuts({
    selectedStampId,
    fileId,
    currentPage,
    totalPages,
    deleteStamp,
    deselectStamp,
  });

  // Resolved ArrayBuffer — either from local cache or fetched from Storage URL
  const [resolvedPdfData, setResolvedPdfData] = useState<ArrayBuffer | null>(null);
  const fetchingRef = useRef<string | null>(null); // track which fileId is being fetched

  useEffect(() => {
    if (!activeFile) {
      setResolvedPdfData(null);
      fetchingRef.current = null;
      return;
    }

    // 1. Check local cache first (fast path — already in memory)
    const local = getFileBuffer(activeFile.id);
    if (local) {
      setResolvedPdfData(local);
      fetchingRef.current = null;
      return;
    }

    // 2. No local buffer — fetch from Firebase Storage URL
    if (!activeFile.storageUrl) {
      setResolvedPdfData(null);
      return;
    }

    // Avoid duplicate fetches for the same file
    if (fetchingRef.current === activeFile.id) return;
    fetchingRef.current = activeFile.id;

    setResolvedPdfData(null); // clear while loading
    fetch(activeFile.storageUrl)
      .then((r) => r.arrayBuffer())
      .then((buf) => {
        addFileBuffer(activeFile.id, buf);
        if (fetchingRef.current === activeFile.id) {
          setResolvedPdfData(buf);
        }
      })
      .catch((err) => {
        console.error("[WorkspacePage] Failed to fetch PDF from storage:", err);
        if (fetchingRef.current === activeFile.id) {
          fetchingRef.current = null;
        }
      });
  }, [activeFile]);

  // Keep pdfData as an alias used below
  const pdfData = resolvedPdfData;

  return (
    <div className="relative flex h-full">
      {/* Mobile backdrop for left panel */}
      {leftPanelOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={toggleLeftPanel}
        />
      )}

      {/* Left panel — File Panel */}
      <aside
        className={cn(
          "z-30 flex h-full w-72 shrink-0 flex-col border-r bg-card transition-transform duration-200",
          "fixed left-0 top-0 md:relative md:translate-x-0",
          leftPanelOpen ? "translate-x-0" : "-translate-x-full md:hidden",
        )}
      >
        <FilePanel />
      </aside>

      {/* Center — PDF Canvas */}
      <section className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar strip */}
        <div className="flex h-10 shrink-0 items-center gap-1 border-b bg-muted/30 px-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleLeftPanel}
            title={leftPanelOpen ? "Hide file panel" : "Show file panel"}
          >
            {leftPanelOpen ? (
              <PanelLeftClose className="h-4 w-4" />
            ) : (
              <PanelLeftOpen className="h-4 w-4" />
            )}
          </Button>

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={toggleRightPanel}
            title={rightPanelOpen ? "Hide stamp panel" : "Show stamp panel"}
          >
            {rightPanelOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Canvas area */}
        <div className="flex flex-1 items-center justify-center overflow-auto bg-muted/10">
          {activeFile ? (
            <PdfCanvas pdfData={pdfData} />
          ) : (
            <>
              <div className="flex flex-col items-center gap-3 text-center">
                <FileUp className="h-12 w-12 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Upload or select a PDF to get started
                </p>
              </div>
              <Onboarding />
            </>
          )}
        </div>
      </section>

      {/* Mobile backdrop for right panel */}
      {rightPanelOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={toggleRightPanel}
        />
      )}

      {/* Right panel — Stamp Panel */}
      <aside
        className={cn(
          "z-30 flex h-full w-72 shrink-0 flex-col border-l bg-card transition-transform duration-200",
          "fixed right-0 top-0 md:relative md:translate-x-0",
          rightPanelOpen ? "translate-x-0" : "translate-x-full md:hidden",
        )}
      >
        <StampPanel />
      </aside>
    </div>
  );
}
