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
  updateDoc,
} from "firebase/firestore";
import type { Unsubscribe } from "firebase/auth";
import { getFirestoreDb } from "@/lib/firebase";
import type { Stamp } from "@/types/stampify";
import { sanitizeForFirestore } from "./utils";

// Re-export so existing consumers that import from here still work.
export { sanitizeForFirestore } from "./utils";

// ---------------------------------------------------------------------------
// Stamps Service
// ---------------------------------------------------------------------------

/**
 * Subscribe to real-time updates for a user's stamps collection.
 *
 * Documents are ordered by `updatedAt` descending.  The callback receives the
 * full array of {@link Stamp} objects on every change.
 *
 * @returns An `Unsubscribe` function to detach the listener.
 */
export function subscribeToStamps(
  uid: string,
  callback: (stamps: Stamp[]) => void,
): Unsubscribe {
  const db = getFirestoreDb();
  const stampsRef = collection(db, "users", uid, "stamps");
  const q = query(stampsRef, orderBy("updatedAt", "desc"));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const stamps: Stamp[] = snapshot.docs.map((d) => ({
        ...d.data(),
        id: d.id,
      })) as Stamp[];
      callback(stamps);
    },
    (error) => {
      console.error("[stamps-service] onSnapshot error:", error);
    },
  );

  return unsubscribe;
}

/**
 * Create a new stamp document under `users/{uid}/stamps`.
 *
 * If `docId` is provided it is used as the document id; otherwise Firestore
 * generates one automatically.
 *
 * @returns The id of the created document.
 */
export async function createStampDocument(
  uid: string,
  stamp: Stamp,
  docId?: string,
): Promise<string> {
  const db = getFirestoreDb();
  const stampsRef = collection(db, "users", uid, "stamps");
  const docRef = docId ? doc(stampsRef, docId) : doc(stampsRef);

  const sanitized = sanitizeForFirestore(stamp) as Record<string, unknown>;

  await setDoc(docRef, {
    ...sanitized,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

/**
 * Update an existing stamp document at `users/{uid}/stamps/{stamp.id}`.
 *
 * Adds an `updatedAt` server timestamp automatically.
 */
export async function updateStampDocument(
  uid: string,
  stamp: Stamp,
): Promise<void> {
  const db = getFirestoreDb();
  const docRef = doc(db, "users", uid, "stamps", stamp.id);

  const sanitized = sanitizeForFirestore(stamp) as Record<string, unknown>;

  await updateDoc(docRef, {
    ...sanitized,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a stamp document at `users/{uid}/stamps/{stampId}`.
 */
export async function deleteStampDocument(
  uid: string,
  stampId: string,
): Promise<void> {
  const db = getFirestoreDb();
  const docRef = doc(db, "users", uid, "stamps", stampId);
  await deleteDoc(docRef);
}
