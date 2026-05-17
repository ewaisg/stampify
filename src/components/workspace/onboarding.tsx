"use client";

import { useCallback, useEffect, useState } from "react";
import { Stamp, Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useStampsStore } from "@/stores/stamps";
import { useFilesStore } from "@/stores/files";
import { useUIStore } from "@/stores/ui";
import { useAuth } from "@/contexts/AuthContext";

const DISMISSED_KEY = "stampify:onboarding-dismissed";

const steps = [
  {
    icon: Stamp,
    title: "Create a Stamp",
    description:
      "Design custom stamps with text, images, or signatures to apply to your PDFs.",
  },
  {
    icon: Upload,
    title: "Upload PDFs",
    description:
      "Drag and drop or browse to upload the PDF documents you want to stamp.",
  },
  {
    icon: Download,
    title: "Apply & Download",
    description:
      "Position your stamps, then export your stamped PDFs ready to share.",
  },
] as const;

export function Onboarding() {
  const [dismissed, setDismissed] = useState(true); // default hidden to avoid flash
  const [storageChecked, setStorageChecked] = useState(false);
  const [syncReady, setSyncReady] = useState(false);

  const { initializing } = useAuth();
  const stamps = useStampsStore((s) => s.stamps);
  const stampsLoading = useStampsStore((s) => s.loading);
  const files = useFilesStore((s) => s.files);
  const filesLoading = useFilesStore((s) => s.loading);
  const rightPanelOpen = useUIStore((s) => s.rightPanelOpen);
  const toggleRightPanel = useUIStore((s) => s.toggleRightPanel);

  // Check localStorage on mount
  useEffect(() => {
    const id = window.setTimeout(() => {
      const stored = localStorage.getItem(DISMISSED_KEY);
      setDismissed(stored === "true");
      setStorageChecked(true);
    }, 0);

    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!storageChecked || initializing || stampsLoading || filesLoading) {
      if (!syncReady) return;

      const id = window.setTimeout(() => setSyncReady(false), 0);
      return () => window.clearTimeout(id);
    }

    if (syncReady) {
      return;
    }

    const id = window.setTimeout(() => setSyncReady(true), 250);
    return () => window.clearTimeout(id);
  }, [filesLoading, initializing, stampsLoading, storageChecked, syncReady]);

  const shouldShow =
    storageChecked &&
    syncReady &&
    !dismissed &&
    stamps.length === 0 &&
    files.length === 0;

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  }, []);

  const handleGetStarted = useCallback(() => {
    if (!rightPanelOpen) {
      toggleRightPanel();
    }
    handleDismiss();
  }, [rightPanelOpen, toggleRightPanel, handleDismiss]);

  if (!shouldShow) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-2xl space-y-6">
        {/* Heading */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white">
            Welcome to Stampify
          </h2>
          <p className="mt-2 text-sm text-white/70">
            Get started in three easy steps
          </p>
        </div>

        {/* Step cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {steps.map((step, idx) => (
            <Card key={step.title} className="bg-card/95 backdrop-blur">
              <CardHeader className="items-center text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <step.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-base">
                  <span className="mr-1.5 text-muted-foreground">
                    {idx + 1}.
                  </span>
                  {step.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <CardDescription>{step.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <Button variant="ghost" className="text-white" onClick={handleDismiss}>
            Dismiss
          </Button>
          <Button onClick={handleGetStarted}>Get Started</Button>
        </div>
      </div>
    </div>
  );
}
