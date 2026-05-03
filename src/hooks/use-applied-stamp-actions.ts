"use client";

import { useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppliedStampsStore } from "@/stores/applied-stamps";
import {
  saveAppliedStamp,
  deleteAppliedStampDoc,
} from "@/lib/firebase/applied-stamps-service";
import { toast } from "@/hooks/use-toast";
import type { AppliedStamp } from "@/types/stampify";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Wraps applied-stamp mutations with Firestore persistence.
 *
 * Each action performs an optimistic local update first and then persists the
 * change to Firestore asynchronously. Errors are surfaced via toast.
 *
 * `updateStamp` is debounced (300 ms) so that rapid move / resize events
 * during a drag do not spam Firestore with writes.
 */
export function useAppliedStampActions() {
  const { user } = useAuth();
  const storeAdd = useAppliedStampsStore((s) => s.addAppliedStamp);
  const storeUpdate = useAppliedStampsStore((s) => s.updateAppliedStamp);
  const storeDelete = useAppliedStampsStore((s) => s.deleteAppliedStamp);
  const storeDuplicate = useAppliedStampsStore((s) => s.duplicateToAllPages);

  // Debounce timer ref for updateStamp
  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep the latest pending stamp so the debounced callback always persists
  // the most recent version.
  const pendingUpdateRef = useRef<{
    fileId: string;
    stamp: AppliedStamp;
  } | null>(null);

  // ---- Add ----

  const addStamp = useCallback(
    (
      fileId: string,
      page: number,
      stamp: Omit<AppliedStamp, "id" | "page">,
    ): AppliedStamp | null => {
      if (!user) {
        toast({
          title: "Not authenticated",
          description: "You must be signed in to place stamps.",
          variant: "destructive",
        });
        return null;
      }

      // Optimistic local update
      const created = storeAdd(fileId, page, stamp);

      // Persist to Firestore
      saveAppliedStamp(user.uid, fileId, created).catch((err) => {
        console.error("[useAppliedStampActions] addStamp failed:", err);
        toast({
          title: "Failed to save stamp",
          description:
            "The stamp could not be saved to the cloud. Please try again.",
          variant: "destructive",
        });
      });

      return created;
    },
    [user, storeAdd],
  );

  // ---- Update (debounced persist) ----

  const updateStamp = useCallback(
    (fileId: string, page: number, stamp: AppliedStamp) => {
      if (!user) return;

      // Optimistic local update — always immediate
      storeUpdate(fileId, page, stamp);

      // Debounce the Firestore write
      pendingUpdateRef.current = { fileId, stamp };

      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }

      const uid = user.uid;
      updateTimerRef.current = setTimeout(() => {
        updateTimerRef.current = null;
        const pending = pendingUpdateRef.current;
        if (!pending) return;
        pendingUpdateRef.current = null;

        saveAppliedStamp(uid, pending.fileId, pending.stamp).catch((err) => {
          console.error("[useAppliedStampActions] updateStamp failed:", err);
          toast({
            title: "Failed to update stamp",
            description:
              "The stamp position could not be saved. Please try again.",
            variant: "destructive",
          });
        });
      }, 300);
    },
    [user, storeUpdate],
  );

  // ---- Delete ----

  const deleteStamp = useCallback(
    (fileId: string, page: number, stampId: string) => {
      if (!user) {
        toast({
          title: "Not authenticated",
          description: "You must be signed in to delete stamps.",
          variant: "destructive",
        });
        return;
      }

      // Optimistic local update
      storeDelete(fileId, page, stampId);

      // Persist to Firestore
      deleteAppliedStampDoc(user.uid, fileId, stampId).catch((err) => {
        console.error("[useAppliedStampActions] deleteStamp failed:", err);
        toast({
          title: "Failed to delete stamp",
          description:
            "The stamp could not be removed from the cloud. Please try again.",
          variant: "destructive",
        });
      });
    },
    [user, storeDelete],
  );

  // ---- Duplicate to all pages ----

  const duplicateToAll = useCallback(
    (fileId: string, baseStamp: AppliedStamp, totalPages: number) => {
      if (!user) {
        toast({
          title: "Not authenticated",
          description: "You must be signed in to duplicate stamps.",
          variant: "destructive",
        });
        return;
      }

      // Optimistic local update
      storeDuplicate(fileId, baseStamp, totalPages);

      // Read back the newly created stamps from the store so we can persist
      // them. The store creates new ids for each duplicated stamp.
      const state = useAppliedStampsStore.getState();
      const fileMap = state.appliedStamps.get(fileId);
      if (!fileMap) return;

      const uid = user.uid;
      const promises: Promise<void>[] = [];

      for (let page = 1; page <= totalPages; page++) {
        if (page === baseStamp.page) continue;
        const pageStamps = fileMap.get(page) ?? [];
        for (const s of pageStamps) {
          // Only persist stamps that match the duplicated stampId at the same
          // position — these are the ones just created by the store.
          if (
            s.stampId === baseStamp.stampId &&
            s.x === baseStamp.x &&
            s.y === baseStamp.y
          ) {
            promises.push(saveAppliedStamp(uid, fileId, s));
          }
        }
      }

      Promise.all(promises).catch((err) => {
        console.error(
          "[useAppliedStampActions] duplicateToAll failed:",
          err,
        );
        toast({
          title: "Failed to duplicate stamps",
          description:
            "Some stamps could not be saved to the cloud. Please try again.",
          variant: "destructive",
        });
      });
    },
    [user, storeDuplicate],
  );

  return { addStamp, updateStamp, deleteStamp, duplicateToAll };
}
