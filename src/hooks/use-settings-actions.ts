"use client";

import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSettingsStore } from "@/stores/settings";
import { saveUserSettings } from "@/lib/firebase/settings-service";
import type { UserSettings } from "@/types/stampify";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Wraps settings mutations with Firestore persistence.
 *
 * Every helper first updates the local Zustand store (which is immediate) and
 * then persists the full settings object to Firestore.  Inbound real-time
 * updates from Firestore are handled separately by `useFirestoreSync`.
 */
export function useSettingsActions() {
  const { user } = useAuth();

  // ------------------------------------------------------------------
  // Core: persist whatever is currently in the store
  // ------------------------------------------------------------------

  const saveSettings = useCallback(async (): Promise<void> => {
    if (!user) return;

    const { settings } = useSettingsStore.getState();

    try {
      await saveUserSettings(user.uid, settings);
    } catch (error) {
      console.error("[useSettingsActions] saveSettings failed:", error);
    }
  }, [user]);

  // ------------------------------------------------------------------
  // Theme
  // ------------------------------------------------------------------

  const updateTheme = useCallback(
    async (theme: UserSettings["theme"]): Promise<void> => {
      useSettingsStore.getState().setTheme(theme);

      if (!user) return;

      try {
        const { settings } = useSettingsStore.getState();
        await saveUserSettings(user.uid, settings);
      } catch (error) {
        console.error("[useSettingsActions] updateTheme failed:", error);
      }
    },
    [user],
  );

  // ------------------------------------------------------------------
  // AI Providers — persist the current AI config
  // ------------------------------------------------------------------

  const saveAIProviders = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      const { settings } = useSettingsStore.getState();
      await saveUserSettings(user.uid, settings);
    } catch (error) {
      console.error("[useSettingsActions] saveAIProviders failed:", error);
    }
  }, [user]);

  return { saveSettings, updateTheme, saveAIProviders };
}
