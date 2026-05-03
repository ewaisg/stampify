"use client";

import { type FirebaseStorage, getStorage } from "firebase/storage";
import { getFirebaseApp } from "./app";

let storage: FirebaseStorage | null = null;

export function getFirebaseStorage(): FirebaseStorage {
  if (storage) {
    return storage;
  }

  storage = getStorage(getFirebaseApp());

  return storage;
}
