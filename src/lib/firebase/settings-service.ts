"use client";

import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type { Unsubscribe } from "firebase/auth";
import { getFirestoreDb } from "@/lib/firebase";
import type { UserSettings } from "@/types/stampify";
import { sanitizeForFirestore } from "./utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns a reference to the single settings/preferences document for a user.
 *
 * Firestore path: `users/{uid}/settings/preferences`
 */
function settingsDocRef(uid: string) {
  const db = getFirestoreDb();
  return doc(db, "users", uid, "settings", "preferences");
}

// ---------------------------------------------------------------------------
// Settings Service
// ---------------------------------------------------------------------------

/**
 * Persist user settings to Firestore using `setDoc` with merge so partial
 * updates don't clobber unrelated fields.
 *
 * The payload is sanitized before writing and an `updatedAt` server timestamp
 * is added automatically.
 */
export async function saveUserSettings(
  uid: string,
  settings: UserSettings,
): Promise<void> {
  const ref = settingsDocRef(uid);
  const sanitized = sanitizeForFirestore(settings) as Record<string, unknown>;

  await setDoc(
    ref,
    {
      ...sanitized,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Load user settings from Firestore.
 *
 * @returns The parsed {@link UserSettings} or `null` if the document does not
 * exist.
 */
export async function loadUserSettings(
  uid: string,
): Promise<UserSettings | null> {
  const ref = settingsDocRef(uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  const data = snap.data() as Record<string, unknown>;

  // Strip Firestore-only metadata before returning
  const { updatedAt: _updatedAt, ...rest } = data;

  return rest as unknown as UserSettings;
}

/**
 * Subscribe to real-time updates on the user's settings document.
 *
 * The callback receives the parsed {@link UserSettings} on every change, or
 * `null` if the document does not exist (yet).
 *
 * @returns An `Unsubscribe` function to detach the listener.
 */
export function subscribeToSettings(
  uid: string,
  callback: (settings: UserSettings | null) => void,
): Unsubscribe {
  const ref = settingsDocRef(uid);

  const unsubscribe = onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        callback(null);
        return;
      }

      const data = snap.data() as Record<string, unknown>;
      const { updatedAt: _updatedAt, ...rest } = data;
      callback(rest as unknown as UserSettings);
    },
    (error) => {
      console.error("[settings-service] onSnapshot error:", error);
    },
  );

  return unsubscribe;
}
