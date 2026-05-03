"use client";

// ---------------------------------------------------------------------------
// Temporary in-memory file storage
// ---------------------------------------------------------------------------
// Holds raw PDF ArrayBuffers keyed by file ID. This is a stopgap until
// Firebase Storage integration is complete; at that point files will be
// streamed from remote URLs instead.
// ---------------------------------------------------------------------------

const fileBuffers = new Map<string, ArrayBuffer>();

export { fileBuffers };

export function addFileBuffer(fileId: string, buffer: ArrayBuffer): void {
  fileBuffers.set(fileId, buffer);
}

export function getFileBuffer(fileId: string): ArrayBuffer | undefined {
  return fileBuffers.get(fileId);
}

export function removeFileBuffer(fileId: string): void {
  fileBuffers.delete(fileId);
}

export function clearFileBuffers(): void {
  fileBuffers.clear();
}
