"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppliedStampsStore } from "@/stores/applied-stamps";
import { subscribeToAppliedStamps } from "@/lib/firebase/applied-stamps-service";

/**
 * Subscribe to Firestore applied-stamps for the active file and keep the
 * Zustand store in sync.
 *
 * When `fileId` changes the previous listener is torn down and a new one is
 * created. On unmount the listener is also cleaned up.
 */
export function useAppliedStampsSync(fileId: string | null) {
  const { user } = useAuth();
  const setFileStamps = useAppliedStampsStore((s) => s.setFileStamps);
  const clearFile = useAppliedStampsStore((s) => s.clearFile);

  useEffect(() => {
    if (!user || !fileId) return;

    const unsubscribe = subscribeToAppliedStamps(
      user.uid,
      fileId,
      (stamps) => {
        setFileStamps(fileId, stamps);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [user, fileId, setFileStamps, clearFile]);
}
