"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { Stamp, AppliedStamp } from "@/types/stampify";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate sample data for a dynamic / prepared stamp preview.
 */
function generateSampleData(stamp: Stamp): Record<string, any> {
  if (stamp.type !== "dynamic" && stamp.type !== "prepared") return {};

  if (stamp.type === "prepared" && stamp.data) return stamp.data;

  const data: Record<string, any> = {};
  for (const field of stamp.fields) {
    switch (field.type) {
      case "staticText":
        data[field.id] = field.value;
        break;
      case "textField":
        data[field.id] = field.placeholder || field.label;
        data[`${field.id}_color`] = "#000000";
        break;
      case "date":
        data[field.id] = new Date().toISOString().slice(0, 10);
        data[`${field.id}_color`] = "#000000";
        break;
      case "image":
        data[field.id] = "";
        break;
    }
  }
  return data;
}

/**
 * Create a preview applied-stamp positioned at origin.
 */
function createPreviewAppliedStamp(stamp: Stamp): AppliedStamp {
  return {
    id: "preview",
    stampId: stamp.id,
    page: 1,
    x: 0,
    y: 0,
    width: stamp.width,
    height: stamp.height,
    baseWidth: stamp.width,
    baseHeight: stamp.height,
    rotation: stamp.type === "text" ? stamp.rotation : 0,
    data: generateSampleData(stamp),
  };
}

// ---------------------------------------------------------------------------
// Fallback canvas renderer
// ---------------------------------------------------------------------------

async function renderPreviewToDataURL(stamp: Stamp): Promise<string> {
  // Try to use the real renderer if available
  try {
    const { renderStampToDataURL } = await import("@/lib/pdf/stamp-renderer");
    const applied = createPreviewAppliedStamp(stamp);
    return await renderStampToDataURL(stamp, applied);
  } catch {
    // Fall back to a simple canvas-based preview
    return renderFallbackPreview(stamp);
  }
}

function renderFallbackPreview(stamp: Stamp): string {
  const canvas = document.createElement("canvas");
  const size = 120;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  // Background
  ctx.fillStyle = "#f4f4f5";
  ctx.fillRect(0, 0, size, size);

  switch (stamp.type) {
    case "text": {
      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.rotate((stamp.rotation * Math.PI) / 180);
      ctx.globalAlpha = stamp.opacity / 100;
      ctx.fillStyle = stamp.fontColor;
      const previewFontSize = Math.min(stamp.fontSize, 20);
      ctx.font = `${previewFontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(stamp.text, 0, 0);

      if (stamp.template.includes("border")) {
        ctx.strokeStyle = stamp.lineColor;
        ctx.lineWidth = 2;
        const tw = ctx.measureText(stamp.text).width + 12;
        const th = previewFontSize + 12;
        if (stamp.template.includes("rounded")) {
          ctx.beginPath();
          const rx = tw / 2;
          const ry = th / 2;
          ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.strokeRect(-tw / 2, -th / 2, tw, th);
        }
      }
      ctx.restore();
      break;
    }

    case "image": {
      ctx.fillStyle = "#d4d4d8";
      ctx.fillRect(10, 10, size - 20, size - 20);
      ctx.fillStyle = "#71717a";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Image", size / 2, size / 2);
      break;
    }

    case "dynamic":
    case "prepared": {
      ctx.fillStyle = stamp.backgroundColor || "#ffffff";
      ctx.fillRect(4, 4, size - 8, size - 8);
      ctx.strokeStyle = "#a1a1aa";
      ctx.lineWidth = 1;
      ctx.strokeRect(4, 4, size - 8, size - 8);

      ctx.fillStyle = "#3f3f46";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      const fieldLabels = stamp.fields.map((f) => f.label);
      const maxShow = Math.min(fieldLabels.length, 4);
      for (let i = 0; i < maxShow; i++) {
        ctx.fillText(fieldLabels[i], size / 2, 30 + i * 20, size - 20);
      }
      if (fieldLabels.length > maxShow) {
        ctx.fillText("...", size / 2, 30 + maxShow * 20);
      }
      break;
    }
  }

  return canvas.toDataURL("image/png");
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface StampPreviewProps {
  stamp: Stamp;
  className?: string;
}

export function StampPreview({ stamp, className }: StampPreviewProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // For image stamps with a data URL, just show it directly
    if (stamp.type === "image" && stamp.storageUrl) {
      setDataUrl(stamp.storageUrl);
      return;
    }

    renderPreviewToDataURL(stamp).then((url) => {
      if (!cancelled) setDataUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [stamp]);

  if (!dataUrl) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded bg-muted text-xs text-muted-foreground",
          className,
        )}
      >
        Loading...
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt={`Preview of ${stamp.name}`}
      className={cn("rounded object-contain", className)}
      draggable={false}
    />
  );
}
