"use client";

import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { useSettingsActions } from "@/hooks/use-settings-actions";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A small ghost button that cycles the theme: system -> light -> dark -> system.
 * Shows an appropriate icon for the current setting.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { updateTheme } = useSettingsActions();

  const cycleTheme = () => {
    const order: Array<"system" | "light" | "dark"> = [
      "system",
      "light",
      "dark",
    ];
    const currentIndex = order.indexOf(theme);
    const nextIndex = (currentIndex + 1) % order.length;
    const next = order[nextIndex];
    setTheme(next);
    updateTheme(next);
  };

  const icon =
    theme === "light" ? (
      <Sun className="h-4 w-4" />
    ) : theme === "dark" ? (
      <Moon className="h-4 w-4" />
    ) : (
      <Monitor className="h-4 w-4" />
    );

  const label =
    theme === "light"
      ? "Switch to dark mode"
      : theme === "dark"
        ? "Switch to system mode"
        : "Switch to light mode";

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8"
      onClick={cycleTheme}
      title={label}
      aria-label={label}
    >
      {icon}
    </Button>
  );
}
