"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Upload,
  FileText,
  Download,
  Trash2,
  Loader2,
  CloudUpload,
  Eraser,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useFilesStore, selectSelectedFiles } from "@/stores/files";
import { useAppliedStampsStore } from "@/stores/applied-stamps";
import { useStampsStore } from "@/stores/stamps";
import { useUIStore } from "@/stores/ui";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { MAX_FILE_SIZE_MB } from "@/config";
import {
  addFileBuffer,
  getFileBuffer,
  removeFileBuffer,
} from "@/lib/pdf/file-manager";
import { downloadStampedPdfs, fetchPdfBytes } from "@/lib/pdf/pdf-export";
import { uploadPdfFile, deletePdfFile } from "@/lib/firebase/storage-service";
import {
  saveFileMetadata,
  deleteFileMetadata,
} from "@/lib/firebase/files-service";
import { deleteAllAppliedStampsForFile } from "@/lib/firebase/applied-stamps-service";
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
  // Auth
  const { user } = useAuth();

  // Stores
  const {
    files,
    activeFileId,
    selectedFileIds,
    loading,
    addFiles,
    updateFile,
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
  const setSelectedStampId = useUIStore((s) => s.setSelectedStampId);

  const selectedFiles = useMemo(
    () => selectSelectedFiles({ files, activeFileId, selectedFileIds, loading }),
    [files, activeFileId, selectedFileIds, loading],
  );

  const hasFiles = files.length > 0;
  const hasSelection = selectedFileIds.size > 0;
  const allSelected = hasFiles && selectedFileIds.size === files.length;
  const selectedAppliedStampCount = useMemo(
    () =>
      Array.from(selectedFileIds).reduce(
        (total, fileId) => total + countStampsForFile(appliedStamps, fileId),
        0,
      ),
    [appliedStamps, selectedFileIds],
  );
  const hasSelectedAppliedStamps = selectedAppliedStampCount > 0;

  // Local state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmClearStamps, setConfirmClearStamps] = useState(false);
  const [clearingStamps, setClearingStamps] = useState(false);
  /** Track which files are currently being uploaded to Storage. */
  const [uploadingFileIds, setUploadingFileIds] = useState<Set<string>>(
    new Set(),
  );

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
      /** Raw File objects we need for uploading to Storage (keyed by fileId). */
      const rawFileMap = new Map<string, File>();

      // Duplicate detection — collect names already present in the store.
      const existingNames = new Set(files.map((f) => f.name));

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

        // Duplicate check
        if (existingNames.has(file.name)) {
          errors.push(`${file.name}: A file with this name already exists.`);
          continue;
        }

        try {
          const buffer = await file.arrayBuffer();
          const fileId = crypto.randomUUID();

          // Store the buffer in the in-memory file manager (immediate use)
          addFileBuffer(fileId, buffer);

          // Count pages using pdfjs-dist
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

          const meta: FileMetadata = {
            id: fileId,
            name: file.name,
            size: file.size,
            pageCount,
            storageUrl: "", // Will be populated after Storage upload
            uploadedAt: new Date(),
            userId: user?.uid ?? "",
          };

          newFileMetas.push(meta);
          rawFileMap.set(fileId, file);
          // Prevent duplicates within the same batch
          existingNames.add(file.name);
        } catch {
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
          title: "Files added",
          description: `${newFileMetas.length} file(s) added. Uploading to cloud...`,
        });

        // ---- Fire-and-forget: persist to Firebase ----
        const uploadIds = new Set(newFileMetas.map((m) => m.id));
        setUploadingFileIds((prev) => new Set([...prev, ...uploadIds]));

        // Process each file in parallel
        for (const meta of newFileMetas) {
          const rawFile = rawFileMap.get(meta.id);
          if (!rawFile || !user) continue;

          (async () => {
            try {
              // 1. Upload PDF to Storage
              const storageUrl = await uploadPdfFile(
                user.uid,
                meta.id,
                rawFile,
              );

              // 2. Update local store with the Storage URL
              updateFile(meta.id, { storageUrl });

              // 3. Save metadata (with URL) to Firestore
              await saveFileMetadata(user.uid, {
                ...meta,
                storageUrl,
              });
            } catch (err) {
              console.error(
                `[FilePanel] Cloud upload failed for "${meta.name}":`,
                err,
              );

              // Still save metadata to Firestore even if Storage fails
              // so the file record persists; the user can retry later.
              try {
                if (user) {
                  await saveFileMetadata(user.uid, meta);
                }
              } catch {
                // Firestore save also failed — nothing more we can do
              }

              toast({
                title: "Cloud upload failed",
                description: `"${meta.name}" could not be uploaded to cloud storage. The file is available locally for this session. Try re-uploading later.`,
                variant: "destructive",
              });
            } finally {
              setUploadingFileIds((prev) => {
                const next = new Set(prev);
                next.delete(meta.id);
                return next;
              });
            }
          })();
        }
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
    [addFiles, updateFile, activeFileId, setActiveFile, setLoading, files, user],
  );

  // -----------------------------------------------------------------------
  // Download selected
  // -----------------------------------------------------------------------

  const handleDownload = useCallback(async () => {
    if (selectedFiles.length === 0) return;
    setDownloading(true);

    try {
      const filesToExport: { name: string; bytes: ArrayBuffer }[] = [];
      const allApplied = new Map<
        string,
        Map<number, import("@/types/stampify").AppliedStamp[]>
      >();

      for (const fileMeta of selectedFiles) {
        // Try local buffer first, fall back to fetching from Storage URL
        let buffer = getFileBuffer(fileMeta.id);

        if (!buffer && fileMeta.storageUrl) {
          try {
            buffer = await fetchPdfBytes(fileMeta.storageUrl);
            // Cache it locally for subsequent operations
            addFileBuffer(fileMeta.id, buffer);
          } catch (err) {
            console.error(
              `[FilePanel] Failed to fetch "${fileMeta.name}" from storage:`,
              err,
            );
            toast({
              title: "Download error",
              description: `Could not retrieve "${fileMeta.name}" from cloud storage.`,
              variant: "destructive",
            });
            continue;
          }
        }

        if (!buffer) {
          toast({
            title: "Missing file data",
            description: `Could not find data for "${fileMeta.name}". The file may need to be re-uploaded.`,
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

      if (filesToExport.length > 0) {
        await downloadStampedPdfs(filesToExport, allApplied, stamps);

        toast({
          title: "Download complete",
          description: `${filesToExport.length} file(s) exported.`,
        });
      }
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

  const handleDeleteSelected = useCallback(async () => {
    const ids = Array.from(selectedFileIds);
    if (ids.length === 0) return;

    setDeleting(true);
    setDeleteDialogOpen(false);

    // Clean up in-memory buffers and applied stamps (local)
    for (const id of ids) {
      removeFileBuffer(id);
      clearFile(id);
    }

    // Remove from local store immediately for responsive UI
    removeFiles(ids);

    toast({
      title: "Files deleted",
      description: `${ids.length} file(s) removed.`,
    });

    // Clean up Firebase resources in the background
    if (user) {
      for (const fileId of ids) {
        (async () => {
          try {
            // Delete applied stamps subcollection first
            await deleteAllAppliedStampsForFile(user.uid, fileId);
          } catch (err) {
            console.error(
              `[FilePanel] Failed to delete applied stamps for file ${fileId}:`,
              err,
            );
          }
          try {
            // Delete the PDF from Storage (may not exist if upload failed)
            await deletePdfFile(user.uid, fileId);
          } catch (err: unknown) {
            const code = (err as { code?: string })?.code;
            if (code !== "storage/object-not-found") {
              console.error(
                `[FilePanel] Failed to delete storage object for file ${fileId}:`,
                err,
              );
            }
            // object-not-found is expected when upload failed — silently ignore
          }
          try {
            // Delete the metadata document from Firestore
            await deleteFileMetadata(user.uid, fileId);
          } catch (err) {
            console.error(
              `[FilePanel] Failed to delete metadata for file ${fileId}:`,
              err,
            );
          }
        })();
      }
    }

    setDeleting(false);
  }, [selectedFileIds, removeFiles, clearFile, user]);

  // -----------------------------------------------------------------------
  // Clear stamps from selected files
  // -----------------------------------------------------------------------

  const handleClearStampsSelected = useCallback(async () => {
    if (!hasSelectedAppliedStamps || clearingStamps) return;

    if (!confirmClearStamps) {
      setConfirmClearStamps(true);
      return;
    }

    const ids = Array.from(selectedFileIds).filter(
      (fileId) => countStampsForFile(appliedStamps, fileId) > 0,
    );
    const clearedCount = ids.reduce(
      (total, fileId) => total + countStampsForFile(appliedStamps, fileId),
      0,
    );

    setClearingStamps(true);
    setConfirmClearStamps(false);
    setSelectedStampId(null);

    for (const fileId of ids) {
      clearFile(fileId);
    }

    toast({
      title: "Stamps cleared",
      description: `${clearedCount} stamp placement${clearedCount === 1 ? "" : "s"} removed.`,
    });

    if (user) {
      await Promise.allSettled(
        ids.map((fileId) => deleteAllAppliedStampsForFile(user.uid, fileId)),
      );
    }

    setClearingStamps(false);
  }, [
    appliedStamps,
    clearFile,
    clearingStamps,
    confirmClearStamps,
    hasSelectedAppliedStamps,
    selectedFileIds,
    setSelectedStampId,
    user,
  ]);

  // Cancel destructive confirmations when clicking elsewhere
  const handlePanelClick = useCallback(() => {
    if (confirmClearStamps) setConfirmClearStamps(false);
  }, [confirmClearStamps]);

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
    <>
      <div
        className={cn("flex h-full flex-col border-r bg-card", className)}
        onClick={handlePanelClick}
      >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <h2 className="text-sm font-semibold">Files</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleUploadClick}
          disabled={loading}
          title="Upload PDF files"
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
                const isUploading = uploadingFileIds.has(file.id);

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

                    {isUploading && (
                      <span title="Uploading to cloud...">
                        <CloudUpload className="h-4 w-4 shrink-0 animate-pulse text-muted-foreground" />
                      </span>
                    )}

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
          <div className="grid gap-1.5 p-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
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
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                variant={confirmClearStamps ? "destructive" : "outline"}
                size="sm"
                className="min-w-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClearStampsSelected();
                }}
                disabled={!hasSelectedAppliedStamps || clearingStamps}
                title="Clear applied stamps from selected files"
              >
                {clearingStamps ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eraser className="h-4 w-4" />
                )}
                {confirmClearStamps ? "Confirm" : "Clear"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-w-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmClearStamps(false);
                  setDeleteDialogOpen(true);
                }}
                disabled={!hasSelection || deleting}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete
              </Button>
            </div>
          </div>
        </>
      ) : (
        /* Empty state */
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/50" />
          <div>
            <p className="text-sm font-medium">No files yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload PDF files to start stamping.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleUploadClick}>
            <Upload className="h-4 w-4" />
            Upload PDFs
          </Button>
        </div>
      )}
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete selected files?</DialogTitle>
            <DialogDescription>
              This will remove {selectedFileIds.size} selected file
              {selectedFileIds.size === 1 ? "" : "s"} and their applied stamp
              placements from Stampify.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteSelected}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
