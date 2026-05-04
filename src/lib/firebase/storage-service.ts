"use client";

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
} from "firebase/storage";
import { getFirebaseStorage } from "@/lib/firebase";
import {
  MAX_FILE_SIZE_MB,
  MAX_IMAGE_SIZE_MB,
  SUPPORTED_IMAGE_TYPES,
} from "@/config";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFileExtension(file: File): string {
  const parts = file.name.split(".");
  return parts.length > 1 ? parts.pop()! : "bin";
}

// ---------------------------------------------------------------------------
// Stamp Image Operations
// ---------------------------------------------------------------------------

/**
 * Upload a stamp image to Firebase Storage.
 *
 * Path: `users/{uid}/stamps/{stampId}/image.{ext}`
 *
 * @returns The public download URL for the uploaded image.
 * @throws If the file exceeds {@link MAX_IMAGE_SIZE_MB} MB or has an unsupported type.
 */
export async function uploadStampImage(
  uid: string,
  stampId: string,
  file: File,
): Promise<string> {
  const maxBytes = MAX_IMAGE_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(
      `Image exceeds the maximum size of ${MAX_IMAGE_SIZE_MB} MB.`,
    );
  }

  if (
    !(SUPPORTED_IMAGE_TYPES as readonly string[]).includes(file.type)
  ) {
    throw new Error(
      `Unsupported image type "${file.type}". Allowed types: ${SUPPORTED_IMAGE_TYPES.join(", ")}.`,
    );
  }

  const storage = getFirebaseStorage();
  const ext = getFileExtension(file);
  const fileRef = ref(storage, `users/${uid}/stamps/${stampId}/image.${ext}`);

  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

/**
 * Delete all objects in a stamp's image folder.
 *
 * Lists everything under `users/{uid}/stamps/{stampId}/` and deletes each item.
 */
export async function deleteStampImage(
  uid: string,
  stampId: string,
): Promise<void> {
  const storage = getFirebaseStorage();
  const folderRef = ref(storage, `users/${uid}/stamps/${stampId}`);

  const result = await listAll(folderRef);
  await Promise.all(result.items.map((itemRef) => deleteObject(itemRef)));
}

// ---------------------------------------------------------------------------
// PDF File Operations
// ---------------------------------------------------------------------------

/**
 * Upload a PDF file to Firebase Storage.
 *
 * Path: `users/{uid}/files/{fileId}.pdf`
 *
 * @returns The public download URL for the uploaded PDF.
 * @throws If the file exceeds {@link MAX_FILE_SIZE_MB} MB or is not a PDF.
 */
export async function uploadPdfFile(
  uid: string,
  fileId: string,
  file: File,
): Promise<string> {
  const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(
      `PDF exceeds the maximum size of ${MAX_FILE_SIZE_MB} MB.`,
    );
  }

  if (file.type !== "application/pdf") {
    throw new Error(
      `Unsupported file type "${file.type}". Only application/pdf is allowed.`,
    );
  }

  const storage = getFirebaseStorage();
  const fileRef = ref(storage, `users/${uid}/files/${fileId}.pdf`);

  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

/**
 * Delete a PDF file from Firebase Storage.
 *
 * Path: `users/{uid}/files/{fileId}.pdf`
 */
export async function deletePdfFile(
  uid: string,
  fileId: string,
): Promise<void> {
  const storage = getFirebaseStorage();
  const fileRef = ref(storage, `users/${uid}/files/${fileId}.pdf`);
  await deleteObject(fileRef);
}

/**
 * Download a PDF from Firebase Storage as an ArrayBuffer.
 *
 * First obtains a short-lived Firebase download URL (with auth token embedded),
 * then routes through /api/pdf — a server-side Next.js proxy — so the browser
 * never sends a cross-origin request to firebasestorage.googleapis.com directly.
 *
 * Path on Storage: `users/{uid}/files/{fileId}.pdf`
 */
export async function downloadPdfAsBuffer(
  uid: string,
  fileId: string,
): Promise<ArrayBuffer> {
  const storage = getFirebaseStorage();
  const fileRef = ref(storage, `users/${uid}/files/${fileId}.pdf`);

  // Get a short-lived signed download URL (includes auth token in query string)
  const storageUrl = await getDownloadURL(fileRef);

  // Proxy through our server route to avoid browser CORS restrictions
  const proxyUrl = `/api/pdf?storageUrl=${encodeURIComponent(storageUrl)}`;
  const response = await fetch(proxyUrl);

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(`Failed to download PDF: ${body.error ?? response.statusText}`);
  }

  return response.arrayBuffer();
}
