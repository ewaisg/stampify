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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively sanitize a value so it is safe to write to Firestore.
 *
 * - `undefined` and functions are stripped.
 * - `NaN` and `Infinity` / `-Infinity` are converted to `null`.
 * - `null`, `Date`, strings, numbers, and booleans pass through as-is.
 * - Arrays and plain objects are traversed recursively.
 */
export function sanitizeForFirestore(value: unknown): unknown {
  // Primitives & null
  if (value === null) return null;
  if (value === undefined) return undefined; // caller strips undefined keys
  if (typeof value === "function") return undefined;

  if (typeof value === "number") {
    if (Number.isNaN(value) || !Number.isFinite(value)) return null;
    return value;
  }

  if (typeof value === "string" || typeof value === "boolean") return value;

  if (value instanceof Date) return value;

  // Arrays
  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeForFirestore(item))
      .filter((item) => item !== undefined);
  }

  // Plain objects
  if (typeof value === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const clean = sanitizeForFirestore(val);
      if (clean !== undefined) {
        sanitized[key] = clean;
      }
    }
    return sanitized;
  }

  return value;
}

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
