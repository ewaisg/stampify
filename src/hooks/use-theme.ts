"use client";

import { useEffect, useMemo, useState } from "react";
import { useUIStore } from "@/stores/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ResolvedTheme = "light" | "dark";

interface UseThemeReturn {
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
  resolvedTheme: ResolvedTheme;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages the theme by reading from the UI store and applying the "dark" class
 * to `document.documentElement`. Handles the "system" preference via
 * `matchMedia("(prefers-color-scheme: dark)")`.
 */
export function useTheme(): UseThemeReturn {
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);

  const [systemPrefersDark, setSystemPrefersDark] = useState(false);

  // Listen for system color-scheme preference changes
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemPrefersDark(mq.matches);

    const handler = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };

    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (theme === "system") return systemPrefersDark ? "dark" : "light";
    return theme;
  }, [theme, systemPrefersDark]);

  // Apply or remove the "dark" class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (resolvedTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [resolvedTheme]);

  return { theme, setTheme, resolvedTheme };
}
