"use client";

import {
  type Firestore,
  getFirestore,
  initializeFirestore,
} from "firebase/firestore";
import { getFirebaseApp } from "./app";

let db: Firestore | null = null;

export function getFirestoreDb(): Firestore {
  if (db) {
    return db;
  }

  const app = getFirebaseApp();

  try {
    db = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    });
  } catch {
    // Firestore was already initialized (e.g. by another module).
    // Fall back to the existing instance.
    db = getFirestore(app);
  }

  return db;
}
