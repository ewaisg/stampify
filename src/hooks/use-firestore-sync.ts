"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useStampsStore } from "@/stores/stamps";
import { useFilesStore } from "@/stores/files";
import { useSettingsStore } from "@/stores/settings";
import { subscribeToStamps } from "@/lib/firebase/stamps-service";
import { subscribeToFiles } from "@/lib/firebase/files-service";
import { subscribeToSettings } from "@/lib/firebase/settings-service";

export function useFirestoreSync() {
  const { user } = useAuth();

  // Stamps store
  const setStamps = useStampsStore((s) => s.setStamps);
  const setStampsLoading = useStampsStore((s) => s.setLoading);
  const resetStamps = useStampsStore((s) => s.reset);

  // Files store
  const setFiles = useFilesStore((s) => s.setFiles);
  const setFilesLoading = useFilesStore((s) => s.setLoading);
  const clearFiles = useFilesStore((s) => s.clearFiles);

  // Settings store
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const resetSettings = useSettingsStore((s) => s.reset);

  // Stamps subscription
  useEffect(() => {
    if (!user) {
      resetStamps();
      return;
    }

    setStampsLoading(true);

    const unsubscribe = subscribeToStamps(user.uid, (remoteStamps) => {
      setStamps(remoteStamps);
      setStampsLoading(false);
    });

    return () => unsubscribe();
  }, [user, setStamps, setStampsLoading, resetStamps]);

  // Files subscription
  useEffect(() => {
    if (!user) {
      clearFiles();
      return;
    }

    setFilesLoading(true);

    const unsubscribe = subscribeToFiles(user.uid, (remoteFiles) => {
      setFiles(remoteFiles);
      setFilesLoading(false);
    });

    return () => unsubscribe();
  }, [user, setFiles, setFilesLoading, clearFiles]);

  // Settings subscription
  useEffect(() => {
    if (!user) {
      resetSettings();
      return;
    }

    const unsubscribe = subscribeToSettings(user.uid, (remoteSettings) => {
      if (remoteSettings) {
        loadSettings(remoteSettings);
      }
    });

    return () => unsubscribe();
  }, [user, loadSettings, resetSettings]);
}
