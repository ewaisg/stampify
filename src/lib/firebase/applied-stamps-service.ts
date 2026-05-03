"use client";

import {
  collection,
  doc,
  deleteDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import type { Unsubscribe } from "firebase/auth";
import { getFirestoreDb } from "@/lib/firebase";
import type { AppliedStamp } from "@/types/stampify";
import { sanitizeForFirestore } from "./utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a reference to the appliedStamps subcollection for a given file.
 *
 * Firestore path: `users/{uid}/files/{fileId}/appliedStamps`
 */
function appliedStampsCollection(uid: string, fileId: string) {
  const db = getFirestoreDb();
  return collection(db, "users", uid, "files", fileId, "appliedStamps");
}

// ---------------------------------------------------------------------------
// Applied Stamps Service
// ---------------------------------------------------------------------------

/**
 * Save (create or update) an applied stamp document.
 *
 * Uses `setDoc` with merge so that partial updates are supported and
 * existing fields are not overwritten unless explicitly provided.
 */
export async function saveAppliedStamp(
  uid: string,
  fileId: string,
  stamp: AppliedStamp,
): Promise<void> {
  const colRef = appliedStampsCollection(uid, fileId);
  const docRef = doc(colRef, stamp.id);

  const sanitized = sanitizeForFirestore(stamp) as Record<string, unknown>;

  await setDoc(
    docRef,
    {
      ...sanitized,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Delete a single applied stamp document.
 */
export async function deleteAppliedStampDoc(
  uid: string,
  fileId: string,
  stampId: string,
): Promise<void> {
  const colRef = appliedStampsCollection(uid, fileId);
  const docRef = doc(colRef, stampId);
  await deleteDoc(docRef);
}

/**
 * Subscribe to real-time updates for all applied stamps on a file.
 *
 * The callback receives the full array of {@link AppliedStamp} objects
 * whenever the subcollection changes.
 *
 * @returns An `Unsubscribe` function to detach the listener.
 */
export function subscribeToAppliedStamps(
  uid: string,
  fileId: string,
  callback: (stamps: AppliedStamp[]) => void,
): Unsubscribe {
  const colRef = appliedStampsCollection(uid, fileId);

  const unsubscribe = onSnapshot(
    colRef,
    (snapshot) => {
      const stamps: AppliedStamp[] = snapshot.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      })) as AppliedStamp[];
      callback(stamps);
    },
    (error) => {
      console.error("[applied-stamps-service] onSnapshot error:", error);
    },
  );

  return unsubscribe;
}

/**
 * Delete all applied stamp documents for a given file.
 *
 * Fetches every document in the subcollection and deletes them in a
 * single batch write.
 */
export async function deleteAllAppliedStampsForFile(
  uid: string,
  fileId: string,
): Promise<void> {
  const db = getFirestoreDb();
  const colRef = appliedStampsCollection(uid, fileId);
  const snapshot = await getDocs(colRef);

  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}
