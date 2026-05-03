"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileSignature, LogOut, Settings, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/workspace/theme-toggle";
import { cn } from "@/lib/utils";
import { AISettingsDialog } from "@/components/ai/ai-settings-dialog";
import { AIStampGenerator } from "@/components/ai/ai-stamp-generator";

export function Header({ className }: { className?: string }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [generatorOpen, setGeneratorOpen] = React.useState(false);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <>
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

        {/* Right: AI + Settings + User email + Sign Out */}
        <div className="flex items-center gap-3">
          {user?.email && (
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user.email}
            </span>
          )}
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setGeneratorOpen(true)}
            title="AI Stamp Generator"
          >
            <Sparkles className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSettingsOpen(true)}
            title="AI Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <AISettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <AIStampGenerator open={generatorOpen} onOpenChange={setGeneratorOpen} />
    </>
  );
}
