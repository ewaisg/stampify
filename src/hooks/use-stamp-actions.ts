"use client";

import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useStampsStore } from "@/stores/stamps";
import { toast } from "@/hooks/use-toast";
import {
  createStampDocument,
  updateStampDocument,
  deleteStampDocument,
} from "@/lib/firebase/stamps-service";
import { uploadStampImage, deleteStampImage } from "@/lib/firebase/storage-service";
import type { NewStamp, Stamp } from "@/types/stampify";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Provides stamp CRUD operations that optimistically update the local Zustand
 * store **and** persist to Firestore.
 *
 * This bridges the gap between Zustand (no access to React context) and the
 * authenticated Firebase user available via `useAuth()`.
 *
 * Inbound real-time updates from Firestore are handled separately by
 * `useFirestoreSync`. Together the two form a complete sync loop.
 */
export function useStampActions() {
  const { user } = useAuth();
  const addStamp = useStampsStore((s) => s.addStamp);
  const updateStamp = useStampsStore((s) => s.updateStamp);
  const deleteStamp = useStampsStore((s) => s.deleteStamp);

  // ---- Create ----

  const createStamp = useCallback(
    async (data: NewStamp): Promise<string | null> => {
      if (!user) {
        toast({
          title: "Not authenticated",
          description: "You must be signed in to create stamps.",
          variant: "destructive",
        });
        return null;
      }

      // Optimistic local update
      const id = addStamp(data);

      try {
        const stamp = useStampsStore.getState().stamps.find((s) => s.id === id);
        if (stamp) {
          await createStampDocument(user.uid, stamp, id);
        }
      } catch (error) {
        // Rollback
        deleteStamp(id);
        console.error("[useStampActions] createStamp failed:", error);
        toast({
          title: "Failed to save stamp",
          description: "The stamp could not be saved to the cloud. Please try again.",
          variant: "destructive",
        });
        return null;
      }

      return id;
    },
    [user, addStamp, deleteStamp],
  );

  // ---- Create image stamp (with Storage upload) ----

  const createImageStamp = useCallback(
    async (
      data: NewStamp,
      imageFile: File,
    ): Promise<string | null> => {
      if (!user) {
        toast({
          title: "Not authenticated",
          description: "You must be signed in to create stamps.",
          variant: "destructive",
        });
        return null;
      }

      // Optimistic local update (uses data-URL storageUrl initially)
      const id = addStamp(data);

      try {
        // Upload the image to Firebase Storage
        const storageUrl = await uploadStampImage(user.uid, id, imageFile);

        // Update the local store with the real storage URL
        updateStamp(id, { storageUrl });

        // Persist to Firestore with the real URL
        const stamp = useStampsStore.getState().stamps.find((s) => s.id === id);
        if (stamp) {
          await createStampDocument(user.uid, stamp, id);
        }
      } catch (error) {
        // Rollback
        deleteStamp(id);
        console.error("[useStampActions] createImageStamp failed:", error);
        toast({
          title: "Failed to save image stamp",
          description: "The image could not be uploaded. Please try again.",
          variant: "destructive",
        });
        return null;
      }

      return id;
    },
    [user, addStamp, updateStamp, deleteStamp],
  );

  // ---- Edit / Update ----

  const editStamp = useCallback(
    async (id: string, patch: Partial<Stamp>): Promise<boolean> => {
      if (!user) {
        toast({
          title: "Not authenticated",
          description: "You must be signed in to update stamps.",
          variant: "destructive",
        });
        return false;
      }

      // Capture previous state for rollback
      const prev = useStampsStore.getState().stamps.find((s) => s.id === id);
      if (!prev) return false;

      // Optimistic local update
      updateStamp(id, patch);

      try {
        const updated = useStampsStore.getState().stamps.find((s) => s.id === id);
        if (updated) {
          await updateStampDocument(user.uid, updated);
        }
      } catch (error) {
        // Rollback
        updateStamp(id, prev);
        console.error("[useStampActions] editStamp failed:", error);
        toast({
          title: "Failed to update stamp",
          description: "The stamp could not be updated in the cloud. Please try again.",
          variant: "destructive",
        });
        return false;
      }

      return true;
    },
    [user, updateStamp],
  );

  // ---- Delete ----

  const removeStamp = useCallback(
    async (id: string): Promise<boolean> => {
      if (!user) {
        toast({
          title: "Not authenticated",
          description: "You must be signed in to delete stamps.",
          variant: "destructive",
        });
        return false;
      }

      // Capture previous state for rollback
      const prev = useStampsStore.getState().stamps.find((s) => s.id === id);

      // Optimistic local update
      deleteStamp(id);

      try {
        await deleteStampDocument(user.uid, id);
        // Best-effort cleanup of any associated storage files
        try {
          await deleteStampImage(user.uid, id);
        } catch {
          // Ignore storage errors — the stamp may not have images
        }
      } catch (error) {
        // Rollback
        if (prev) {
          addStamp(prev);
        }
        console.error("[useStampActions] removeStamp failed:", error);
        toast({
          title: "Failed to delete stamp",
          description: "The stamp could not be removed from the cloud. Please try again.",
          variant: "destructive",
        });
        return false;
      }

      return true;
    },
    [user, addStamp, deleteStamp],
  );

  return { createStamp, createImageStamp, editStamp, removeStamp };
}
