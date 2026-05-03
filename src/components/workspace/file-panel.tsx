"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Upload,
  FileText,
  Download,
  Trash2,
  CheckSquare,
  Square,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useFilesStore, selectSelectedFiles } from "@/stores/files";
import { useAppliedStampsStore } from "@/stores/applied-stamps";
import { useStampsStore } from "@/stores/stamps";
import { toast } from "@/hooks/use-toast";
import { MAX_FILE_SIZE_MB } from "@/config";
import {
  addFileBuffer,
  getFileBuffer,
  removeFileBuffer,
} from "@/lib/pdf/file-manager";
import { downloadStampedPdfs } from "@/lib/pdf/pdf-export";
import type { FileMetadata } from "@/types/stampify";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Count total applied stamps for a given file across all pages. */
function countStampsForFile(
  appliedStamps: Map<string, Map<number, { id: string }[]>>,
  fileId: string,
): number {
  const pageMap = appliedStamps.get(fileId);
  if (!pageMap) return 0;
  let total = 0;
  for (const stamps of pageMap.values()) {
    total += stamps.length;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FilePanel({ className }: { className?: string }) {
  // Stores
  const {
    files,
    activeFileId,
    selectedFileIds,
    loading,
    addFiles,
    removeFiles,
    setActiveFile,
    toggleFileSelection,
    selectAll,
    deselectAll,
    setLoading,
  } = useFilesStore();

  const stamps = useStampsStore((s) => s.stamps);
  const appliedStamps = useAppliedStampsStore((s) => s.appliedStamps);
  const clearFile = useAppliedStampsStore((s) => s.clearFile);

  const selectedFiles = useMemo(
    () => selectSelectedFiles({ files, activeFileId, selectedFileIds, loading }),
    [files, activeFileId, selectedFileIds, loading],
  );

  const hasStamps = stamps.length > 0;
  const hasFiles = files.length > 0;
  const hasSelection = selectedFileIds.size > 0;
  const allSelected = hasFiles && selectedFileIds.size === files.length;

  // Local state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // -----------------------------------------------------------------------
  // File upload
  // -----------------------------------------------------------------------

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputFiles = e.target.files;
      if (!inputFiles || inputFiles.length === 0) return;

      setLoading(true);

      const newFileMetas: FileMetadata[] = [];
      const errors: string[] = [];

      for (let i = 0; i < inputFiles.length; i++) {
        const file = inputFiles[i];

        // Validate type
        if (file.type !== "application/pdf") {
          errors.push(`${file.name}: Not a PDF file.`);
          continue;
        }

        // Validate size
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
          errors.push(`${file.name}: Exceeds ${MAX_FILE_SIZE_MB}MB limit.`);
          continue;
        }

        try {
          const buffer = await file.arrayBuffer();
          const fileId = crypto.randomUUID();

          // Store the buffer in the in-memory file manager
          addFileBuffer(fileId, buffer);

          // Attempt to read page count using pdfjs-dist
          let pageCount = 0;
          try {
            const pdfjsLib = await import("pdfjs-dist");
            const doc = await pdfjsLib.getDocument({ data: buffer.slice(0) })
              .promise;
            pageCount = doc.numPages;
          } catch {
            // If we can't read page count, default to 0
            pageCount = 0;
          }

          newFileMetas.push({
            id: fileId,
            name: file.name,
            size: file.size,
            pageCount,
            storageUrl: "", // No remote URL yet — in-memory only
            uploadedAt: new Date(),
            userId: "", // Will be set when Firebase auth is integrated
          });
        } catch (err) {
          errors.push(`${file.name}: Failed to read file.`);
        }
      }

      if (newFileMetas.length > 0) {
        addFiles(newFileMetas);

        // Auto-activate the first uploaded file if nothing is active
        if (!activeFileId) {
          setActiveFile(newFileMetas[0].id);
        }

        toast({
          title: "Files uploaded",
          description: `${newFileMetas.length} file(s) added successfully.`,
        });
      }

      if (errors.length > 0) {
        toast({
          title: "Upload errors",
          description: errors.join("\n"),
          variant: "destructive",
        });
      }

      setLoading(false);

      // Reset input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [addFiles, activeFileId, setActiveFile, setLoading],
  );

  // -----------------------------------------------------------------------
  // Download selected
  // -----------------------------------------------------------------------

  const handleDownload = useCallback(async () => {
    if (selectedFiles.length === 0) return;
    setDownloading(true);

    try {
      const filesToExport: { name: string; bytes: ArrayBuffer }[] = [];
      const allApplied = new Map<string, Map<number, import("@/types/stampify").AppliedStamp[]>>();

      for (const fileMeta of selectedFiles) {
        const buffer = getFileBuffer(fileMeta.id);
        if (!buffer) {
          toast({
            title: "Missing file data",
            description: `Could not find data for "${fileMeta.name}".`,
            variant: "destructive",
          });
          continue;
        }

        filesToExport.push({ name: fileMeta.name, bytes: buffer });

        const pageMap = appliedStamps.get(fileMeta.id);
        if (pageMap) {
          allApplied.set(fileMeta.name, pageMap);
        }
      }

      await downloadStampedPdfs(filesToExport, allApplied, stamps);

      toast({
        title: "Download complete",
        description: `${filesToExport.length} file(s) exported.`,
      });
    } catch (err) {
      console.error("Download failed:", err);
      toast({
        title: "Download failed",
        description: "An error occurred while exporting PDFs.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  }, [selectedFiles, appliedStamps, stamps]);

  // -----------------------------------------------------------------------
  // Delete selected
  // -----------------------------------------------------------------------

  const handleDeleteSelected = useCallback(() => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    const ids = Array.from(selectedFileIds);

    // Clean up in-memory buffers and applied stamps
    for (const id of ids) {
      removeFileBuffer(id);
      clearFile(id);
    }

    removeFiles(ids);
    setConfirmDelete(false);

    toast({
      title: "Files deleted",
      description: `${ids.length} file(s) removed.`,
    });
  }, [confirmDelete, selectedFileIds, removeFiles, clearFile]);

  // Cancel delete confirmation when clicking elsewhere
  const handlePanelClick = useCallback(() => {
    if (confirmDelete) setConfirmDelete(false);
  }, [confirmDelete]);

  // -----------------------------------------------------------------------
  // Toggle all selection
  // -----------------------------------------------------------------------

  const handleToggleAll = useCallback(() => {
    if (allSelected) {
      deselectAll();
    } else {
      selectAll();
    }
  }, [allSelected, selectAll, deselectAll]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div
      className={cn("flex flex-col border-r bg-card", className)}
      onClick={handlePanelClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="text-sm font-semibold">Files</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleUploadClick}
          disabled={!hasStamps || loading}
          title={
            hasStamps
              ? "Upload PDF files"
              : "Add stamps before uploading PDFs"
          }
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Upload</span>
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <Separator />

      {/* File list */}
      {hasFiles ? (
        <>
          {/* Select-all row */}
          <div className="flex items-center gap-2 px-3 py-1.5">
            <Checkbox
              checked={allSelected}
              onCheckedChange={handleToggleAll}
              aria-label="Select all files"
            />
            <button
              onClick={handleToggleAll}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {allSelected ? "Deselect all" : "Select all"}
            </button>
          </div>

          <Separator />

          <ScrollArea className="flex-1">
            <ul className="divide-y">
              {files.map((file) => {
                const isActive = file.id === activeFileId;
                const isSelected = selectedFileIds.has(file.id);
                const stampCount = countStampsForFile(appliedStamps, file.id);

                return (
                  <li
                    key={file.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 transition-colors hover:bg-accent/50",
                      isActive && "bg-accent",
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleFileSelection(file.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${file.name}`}
                    />

                    <button
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => setActiveFile(file.id)}
                    >
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-sm",
                            isActive && "font-medium",
                          )}
                          title={file.name}
                        >
                          {file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(file.size)}
                          {file.pageCount > 0 &&
                            ` · ${file.pageCount} page${file.pageCount !== 1 ? "s" : ""}`}
                        </p>
                      </div>
                    </button>

                    {stampCount > 0 && (
                      <Badge variant="secondary" className="shrink-0">
                        {stampCount}
                      </Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>

          <Separator />

          {/* Actions footer */}
          <div className="flex items-center gap-1.5 p-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleDownload}
              disabled={!hasSelection || downloading}
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download
            </Button>
            <Button
              variant={confirmDelete ? "destructive" : "outline"}
              size="sm"
              className="flex-1"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteSelected();
              }}
              disabled={!hasSelection}
            >
              <Trash2 className="h-4 w-4" />
              {confirmDelete ? "Confirm?" : "Delete"}
            </Button>
          </div>
        </>
      ) : (
        /* Empty state */
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/50" />
          <div>
            <p className="text-sm font-medium">No files yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {hasStamps
                ? "Upload PDF files to start stamping."
                : "Create stamps first, then upload PDFs."}
            </p>
          </div>
          {hasStamps && (
            <Button variant="outline" size="sm" onClick={handleUploadClick}>
              <Upload className="h-4 w-4" />
              Upload PDFs
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
