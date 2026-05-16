"use client";

import { useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { useFilesStore, selectActiveFile } from "@/stores/files";
import { useAppliedStampActions } from "@/hooks/use-applied-stamp-actions";
import { useSettingsStore, selectActiveAIConfig } from "@/stores/settings";
import { getFileBuffer } from "@/lib/pdf/file-manager";
import { downloadPdfAsBuffer } from "@/lib/firebase/storage-service";
import { useAuth } from "@/contexts/AuthContext";
import type { Stamp } from "@/types/stampify";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AIPlacementProgress {
  current: number;
  total: number;
  status: "idle" | "running" | "done" | "error";
  error?: string;
  /** Set when the AI call failed and the fallback position was used instead */
  aiWarning?: string;
}

const RENDER_SCALE = 1;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function renderPageToBase64(
  pdfData: ArrayBuffer,
  pageNumber: number,
): Promise<{ base64: string; pageWidth: number; pageHeight: number }> {
  const doc = await pdfjsLib.getDocument({ data: pdfData.slice(0) }).promise;
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: RENDER_SCALE });

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport }).promise;

  const dataUrl = canvas.toDataURL("image/png");
  // Strip "data:image/png;base64,"
  const base64 = dataUrl.split(",")[1];

  // Page dimensions in PDF points (not pixel units) — divide by scale
  const pageWidth = viewport.width / RENDER_SCALE;
  const pageHeight = viewport.height / RENDER_SCALE;

  doc.destroy();
  return { base64, pageWidth, pageHeight };
}

async function fetchPlacement(
  imageBase64: string,
  stampWidth: number,
  stampHeight: number,
  pageWidth: number,
  pageHeight: number,
  providerConfig: ReturnType<typeof selectActiveAIConfig>,
): Promise<{ x: number; y: number; aiError?: string; usedFallback?: boolean }> {
  if (!providerConfig) {
    const margin = Math.min(20, pageWidth * 0.03);
    return {
      x: Math.max(0, Math.round(pageWidth - stampWidth - margin)),
      y: Math.max(0, Math.round(pageHeight - stampHeight - margin)),
      usedFallback: true,
    };
  }

  const res = await fetch("/api/ai/stamp-placement", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageBase64,
      stampWidth,
      stampHeight,
      pageWidth,
      pageHeight,
      provider: providerConfig,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Placement API error (${res.status}): ${text}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAIStampPlacement() {
  const [progress, setProgress] = useState<AIPlacementProgress>({
    current: 0,
    total: 0,
    status: "idle",
  });

  const { user } = useAuth();
  const activeFile = useFilesStore(selectActiveFile);
  const activeFileId = useFilesStore((s) => s.activeFileId);
  const aiConfig = useSettingsStore(selectActiveAIConfig);
  const { addStamp } = useAppliedStampActions();

  const placeStampOnAllPages = useCallback(
    async (stamp: Stamp, fieldData?: Record<string, any>) => {
      if (!activeFile || !activeFileId) return;

      const pageCount = activeFile.pageCount;
      setProgress({ current: 0, total: pageCount, status: "running" });

      try {
        // Ensure we have the PDF buffer
        let pdfBuffer = getFileBuffer(activeFileId);
        if (!pdfBuffer) {
          if (!user) throw new Error("Not authenticated.");
          pdfBuffer = await downloadPdfAsBuffer(user.uid, activeFileId);
        }

        let firstAIError: string | undefined;

        for (let page = 1; page <= pageCount; page++) {
          const { base64, pageWidth, pageHeight } = await renderPageToBase64(pdfBuffer, page);

          const result = await fetchPlacement(
            base64,
            stamp.width,
            stamp.height,
            pageWidth,
            pageHeight,
            aiConfig,
          );

          if (result.aiError && !firstAIError) {
            firstAIError = result.aiError;
          }

          addStamp(activeFileId, page, {
            stampId: stamp.id,
            x: result.x,
            y: result.y,
            width: stamp.width,
            height: stamp.height,
            baseWidth: stamp.width,
            baseHeight: stamp.height,
            rotation: stamp.type === "text" ? stamp.rotation : 0,
            data: stamp.type === "prepared" ? stamp.data : fieldData,
          });

          setProgress({ current: page, total: pageCount, status: "running" });
        }

        setProgress({
          current: pageCount,
          total: pageCount,
          status: "done",
          aiWarning: firstAIError
            ? `AI placement failed (${firstAIError.slice(0, 120)}). Stamps were placed in the bottom-right corner instead.`
            : undefined,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "AI placement failed.";
        console.error("[useAIStampPlacement]", err);
        setProgress((prev) => ({ ...prev, status: "error", error: message }));
      }
    },
    [activeFile, activeFileId, aiConfig, user, addStamp],
  );

  function reset() {
    setProgress({ current: 0, total: 0, status: "idle" });
  }

  return { placeStampOnAllPages, progress, reset };
}
