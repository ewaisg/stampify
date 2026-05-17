"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  FileSignature,
  LayoutDashboard,
  LogOut,
  Settings,
  Sparkles,
  Stamp,
  WandSparkles,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AISettingsDialog } from "@/components/ai/ai-settings-dialog";
import { AIStampGenerator } from "@/components/ai/ai-stamp-generator";
import { useTheme } from "@/hooks/use-theme";
import { useSettingsActions } from "@/hooks/use-settings-actions";
import { useUIStore } from "@/stores/ui";

export function Header({ className }: { className?: string }) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { updateTheme } = useSettingsActions();
  const workspaceView = useUIStore((s) => s.workspaceView);
  const setWorkspaceView = useUIStore((s) => s.setWorkspaceView);

  const [appSettingsOpen, setAppSettingsOpen] = React.useState(false);
  const [aiSettingsOpen, setAISettingsOpen] = React.useState(false);
  const [generatorOpen, setGeneratorOpen] = React.useState(false);

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const handleThemeChange = (nextTheme: "light" | "dark" | "system") => {
    setTheme(nextTheme);
    void updateTheme(nextTheme);
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

        <nav className="flex items-center gap-1 rounded-md border bg-background p-1">
          <Button
            type="button"
            variant={workspaceView === "dashboard" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 px-2"
            onClick={() => setWorkspaceView("dashboard")}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Button>
          <Button
            type="button"
            variant={workspaceView === "stamping" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 px-2"
            onClick={() => setWorkspaceView("stamping")}
          >
            <Stamp className="h-4 w-4" />
            <span className="hidden sm:inline">Stamping Tool</span>
          </Button>
        </nav>

        {/* Right: Settings + User email + Sign Out */}
        <div className="flex items-center gap-3">
          {user?.email && (
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user.email}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setAppSettingsOpen(true)}
            title="Settings"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </div>
      </header>

      <Dialog open={appSettingsOpen} onOpenChange={setAppSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Manage app preferences and AI tools.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="app-theme">Theme</Label>
              <Select
                id="app-theme"
                value={theme}
                onChange={(e) =>
                  handleThemeChange(e.target.value as "light" | "dark" | "system")
                }
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </Select>
              <p className="text-xs text-muted-foreground">
                Current display: {resolvedTheme}
              </p>
            </div>

            <div className="grid gap-2">
              <Button
                type="button"
                variant="outline"
                className="justify-start"
                onClick={() => {
                  setAppSettingsOpen(false);
                  setGeneratorOpen(true);
                }}
              >
                <Sparkles className="h-4 w-4" />
                AI stamp generator
              </Button>
              <Button
                type="button"
                variant="outline"
                className="justify-start"
                onClick={() => {
                  setAppSettingsOpen(false);
                  setAISettingsOpen(true);
                }}
              >
                <WandSparkles className="h-4 w-4" />
                AI provider setup
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AISettingsDialog open={aiSettingsOpen} onOpenChange={setAISettingsOpen} />
      <AIStampGenerator open={generatorOpen} onOpenChange={setGeneratorOpen} />
    </>
  );
}
