"use client";

import { cn } from "@/lib/utils";

export function Footer({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "flex h-10 shrink-0 items-center justify-end border-t px-4",
        className,
      )}
    >
      <span className="text-xs text-muted-foreground">Stampify v2.0</span>
    </footer>
  );
}
