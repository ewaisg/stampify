"use client";

import {
  type Auth,
  browserLocalPersistence,
  getAuth,
  setPersistence,
} from "firebase/auth";
import { getFirebaseApp } from "./app";

let auth: Auth | null = null;

export function getFirebaseAuth(): Auth {
  if (auth) {
    return auth;
  }

  auth = getAuth(getFirebaseApp());
  setPersistence(auth, browserLocalPersistence);

  return auth;
}
