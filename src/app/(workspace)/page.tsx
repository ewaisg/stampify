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
import { getFileBuffer, addFileBuffer } from "@/lib/pdf/file-manager";
import { downloadPdfAsBuffer } from "@/lib/firebase/storage-service";
import { useAuth } from "@/contexts/AuthContext";
import { useCallback, useEffect, useRef, useState } from "react";

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

  const { user } = useAuth();
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [pdfFetchError, setPdfFetchError] = useState<string | null>(null);
  const [pdfFetching, setPdfFetching] = useState(false);
  const loadingFileIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeFile) {
      setPdfData(null);
      setPdfFetchError(null);
      setPdfFetching(false);
      loadingFileIdRef.current = null;
      return;
    }

    // Fast path — buffer already in memory (just uploaded this session)
    const local = getFileBuffer(activeFile.id);
    if (local) {
      setPdfData(local);
      setPdfFetchError(null);
      setPdfFetching(false);
      return;
    }

    if (!user) {
      setPdfData(null);
      setPdfFetchError("Not authenticated.");
      setPdfFetching(false);
      return;
    }

    // Avoid duplicate downloads for the same file
    if (loadingFileIdRef.current === activeFile.id) return;
    loadingFileIdRef.current = activeFile.id;
    setPdfData(null);
    setPdfFetchError(null);
    setPdfFetching(true);

    downloadPdfAsBuffer(user.uid, activeFile.id)
      .then((buf) => {
        addFileBuffer(activeFile.id, buf);
        if (loadingFileIdRef.current === activeFile.id) {
          setPdfData(buf);
          setPdfFetching(false);
        }
      })
      .catch((err) => {
        console.error("[WorkspacePage] Failed to download PDF from Storage:", err);
        if (loadingFileIdRef.current === activeFile.id) {
          loadingFileIdRef.current = null;
          setPdfFetching(false);
          setPdfFetchError("Failed to load PDF from cloud storage. Please try re-uploading the file.");
        }
      });
  }, [activeFile, user]);

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
            pdfFetchError ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <p className="text-sm text-destructive">{pdfFetchError}</p>
              </div>
            ) : (
              <PdfCanvas pdfData={pdfData} fetching={pdfFetching} />
            )
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
