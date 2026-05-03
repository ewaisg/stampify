"use client";

import { useRouter } from "next/navigation";
import { FileSignature, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Header({ className }: { className?: string }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <header
      className={cn(
        "flex h-14 shrink-0 items-center justify-between border-b bg-card px-4",
        className,
      )}
    >
      {/* Left: Logo + title */}
      <div className="flex items-center gap-2">
        <FileSignature className="h-5 w-5 text-primary" />
        <span className="text-lg font-semibold tracking-tight">Stampify</span>
      </div>

      {/* Right: User email + Sign Out */}
      <div className="flex items-center gap-3">
        {user?.email && (
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {user.email}
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
