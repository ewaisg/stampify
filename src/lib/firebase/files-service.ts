"use client";

import {
  collection,
  doc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type { Unsubscribe } from "firebase/auth";
import { getFirestoreDb } from "@/lib/firebase";
import type { FileMetadata } from "@/types/stampify";
import { sanitizeForFirestore } from "./utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a reference to the files collection for a given user.
 *
 * Firestore path: `users/{uid}/files`
 */
function filesCollection(uid: string) {
  const db = getFirestoreDb();
  return collection(db, "users", uid, "files");
}

// ---------------------------------------------------------------------------
// Files Service
// ---------------------------------------------------------------------------

/**
 * Save file metadata to Firestore.
 *
 * Uses `setDoc` to create or fully replace the document.
 */
export async function saveFileMetadata(
  uid: string,
  file: FileMetadata,
): Promise<void> {
  const colRef = filesCollection(uid);
  const docRef = doc(colRef, file.id);

  const sanitized = sanitizeForFirestore(file) as Record<string, unknown>;

  await setDoc(docRef, {
    ...sanitized,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a file metadata document from Firestore.
 */
export async function deleteFileMetadata(
  uid: string,
  fileId: string,
): Promise<void> {
  const colRef = filesCollection(uid);
  const docRef = doc(colRef, fileId);
  await deleteDoc(docRef);
}

/**
 * Subscribe to real-time updates for a user's files collection.
 *
 * Documents are ordered by `uploadedAt` descending. The callback receives
 * the full array of {@link FileMetadata} objects on every change.
 *
 * @returns An `Unsubscribe` function to detach the listener.
 */
export function subscribeToFiles(
  uid: string,
  callback: (files: FileMetadata[]) => void,
): Unsubscribe {
  const colRef = filesCollection(uid);
  const q = query(colRef, orderBy("uploadedAt", "desc"));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const files: FileMetadata[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          // Firestore Timestamps -> JS Date
          uploadedAt: data.uploadedAt?.toDate?.() ?? new Date(data.uploadedAt),
        } as FileMetadata;
      });
      callback(files);
    },
    (error) => {
      console.error("[files-service] onSnapshot error:", error);
    },
  );

  return unsubscribe;
}
