"use client";

import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useStampsStore } from "@/stores/stamps";
import { subscribeToStamps } from "@/lib/firebase/stamps-service";

export function useFirestoreSync() {
  const { user } = useAuth();
  const setStamps = useStampsStore((s) => s.setStamps);
  const setLoading = useStampsStore((s) => s.setLoading);
  const reset = useStampsStore((s) => s.reset);

  useEffect(() => {
    if (!user) {
      reset();
      return;
    }

    setLoading(true);

    const unsubscribe = subscribeToStamps(user.uid, (remoteStamps) => {
      setStamps(remoteStamps);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, setStamps, setLoading, reset]);
}
