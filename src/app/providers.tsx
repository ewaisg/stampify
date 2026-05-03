"use client";

import { type ReactNode } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/use-theme";

// ---------------------------------------------------------------------------
// Inner component that activates the theme hook so the "dark" class is
// applied to <html> on mount. Must be rendered inside the store context.
// ---------------------------------------------------------------------------

function ThemeProvider({ children }: { children: ReactNode }) {
  useTheme();
  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Root providers
// ---------------------------------------------------------------------------

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </AuthProvider>
  );
}
