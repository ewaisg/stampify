"use client";

import { useState, useCallback } from "react";
import { Sparkles, Loader2, CheckCircle2, AlertCircle, ImagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAIStampPlacement } from "@/hooks/use-ai-stamp-placement";
import { useFilesStore, selectActiveFile } from "@/stores/files";
import { useSettingsStore, selectActiveAIConfig } from "@/stores/settings";
import type { Stamp, DynamicField, DynamicStamp, PreparedStamp } from "@/types/stampify";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AIPlacementDialogProps {
  stamp: Stamp | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Field input for dynamic / prepared stamps
// ---------------------------------------------------------------------------

function DynamicFieldInput({
  field,
  value,
  color,
  onValueChange,
  onColorChange,
}: {
  field: DynamicField;
  value: any;
  color: string;
  onValueChange: (v: any) => void;
  onColorChange: (c: string) => void;
}) {
  const [imgPreview, setImgPreview] = useState<string>(
    field.type === "image" && typeof value === "string" ? value : "",
  );

  const handleImage = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setImgPreview(url);
      onValueChange(url);
    };
    reader.readAsDataURL(file);
  }, [onValueChange]);

  switch (field.type) {
    case "staticText":
      return (
        <div className="space-y-1.5">
          <Label className="text-muted-foreground">{field.label}</Label>
          <p className="rounded-md border border-input bg-muted/50 px-3 py-2 text-sm">
            {field.value}
          </p>
        </div>
      );

    case "textField":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={`ai-f-${field.id}`}>{field.label}</Label>
          <div className="flex gap-2">
            <Input
              id={`ai-f-${field.id}`}
              placeholder={field.placeholder ?? ""}
              value={value ?? ""}
              onChange={(e) => onValueChange(e.target.value)}
              className="flex-1"
            />
            <input
              type="color"
              value={color}
              onChange={(e) => onColorChange(e.target.value)}
              className="h-10 w-10 cursor-pointer rounded-md border border-input"
              title="Text color"
            />
          </div>
        </div>
      );

    case "date":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={`ai-f-${field.id}`}>{field.label}</Label>
          <div className="flex gap-2">
            <Input
              id={`ai-f-${field.id}`}
              type="date"
              value={value ?? ""}
              onChange={(e) => onValueChange(e.target.value)}
              className="flex-1"
            />
            <input
              type="color"
              value={color}
              onChange={(e) => onColorChange(e.target.value)}
              className="h-10 w-10 cursor-pointer rounded-md border border-input"
              title="Text color"
            />
          </div>
        </div>
      );

    case "image":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={`ai-f-${field.id}`}>{field.label}</Label>
          {imgPreview ? (
            <div className="rounded-md border border-input p-2">
              <img src={imgPreview} alt={field.label} className="mx-auto max-h-24 object-contain" />
            </div>
          ) : (
            <label
              htmlFor={`ai-f-${field.id}`}
              className="flex h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-input bg-muted/50 text-muted-foreground hover:border-primary hover:bg-muted"
            >
              <ImagePlus className="h-5 w-5" />
              <span className="text-xs">Upload image</span>
            </label>
          )}
          <input
            id={`ai-f-${field.id}`}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            className={imgPreview ? "text-sm" : "sr-only"}
            onChange={handleImage}
          />
        </div>
      );

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Placing stamp on pages…</span>
        <span>{current} / {total}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

export function AIPlacementDialog({ stamp, open, onOpenChange }: AIPlacementDialogProps) {
  const activeFile = useFilesStore(selectActiveFile);
  const aiConfig = useSettingsStore(selectActiveAIConfig);
  const { placeStampOnAllPages, progress, reset } = useAIStampPlacement();

  const hasDynamicFields =
    stamp &&
    (stamp.type === "dynamic" || stamp.type === "prepared") &&
    (stamp as DynamicStamp | PreparedStamp).fields.some((f) => f.type !== "staticText");

  const fields: DynamicField[] =
    stamp && (stamp.type === "dynamic" || stamp.type === "prepared")
      ? (stamp as DynamicStamp | PreparedStamp).fields
      : [];

  const existingData: Record<string, any> =
    stamp?.type === "prepared" ? (stamp as PreparedStamp).data : {};

  const [fieldData, setFieldData] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    for (const f of fields) {
      init[f.id] = existingData[f.id] ?? (f.type === "staticText" ? f.value : "");
    }
    return init;
  });

  const [fieldColors, setFieldColors] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) {
      init[f.id] = existingData[`${f.id}_color`] ?? "#000000";
    }
    return init;
  });

  function updateValue(id: string, v: any) {
    setFieldData((p) => ({ ...p, [id]: v }));
  }
  function updateColor(id: string, c: string) {
    setFieldColors((p) => ({ ...p, [id]: c }));
  }

  async function handleStart() {
    if (!stamp) return;

    const data: Record<string, any> = {};
    for (const f of fields) {
      data[f.id] = fieldData[f.id] ?? "";
      if (f.type === "textField" || f.type === "date") {
        data[`${f.id}_color`] = fieldColors[f.id] ?? "#000000";
      }
    }

    await placeStampOnAllPages(stamp, Object.keys(data).length > 0 ? data : undefined);
  }

  function handleClose(open: boolean) {
    if (progress.status === "running") return;
    if (!open) reset();
    onOpenChange(open);
  }

  const isRunning = progress.status === "running";
  const isDone = progress.status === "done";
  const isError = progress.status === "error";
  const isIdle = progress.status === "idle";

  const pageCount = activeFile?.pageCount ?? 0;
  const noFile = !activeFile;
  const noAI = !aiConfig;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Stamp Placement
          </DialogTitle>
          <DialogDescription>
            {noFile
              ? "Open a PDF file first to use AI placement."
              : noAI
              ? "Configure an AI provider in settings to enable automatic placement."
              : `The AI will find the best clear area on each of the ${pageCount} page${pageCount !== 1 ? "s" : ""} and stamp automatically.`}
          </DialogDescription>
        </DialogHeader>

        {/* Status: no file or no AI */}
        {(noFile || noAI) && (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {noFile ? "No file is currently open." : "No AI provider is configured."}
          </div>
        )}

        {/* Dynamic fields */}
        {!noFile && !noAI && hasDynamicFields && isIdle && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Fill in stamp fields</p>
            {fields.map((f) => (
              <DynamicFieldInput
                key={f.id}
                field={f}
                value={fieldData[f.id]}
                color={fieldColors[f.id] ?? "#000000"}
                onValueChange={(v) => updateValue(f.id, v)}
                onColorChange={(c) => updateColor(f.id, c)}
              />
            ))}
          </div>
        )}

        {/* Running progress */}
        {isRunning && <ProgressBar current={progress.current} total={progress.total} />}

        {/* Done */}
        {isDone && !progress.aiWarning && (
          <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Stamp placed on all {progress.total} pages. You can adjust placement manually.
          </div>
        )}
        {isDone && progress.aiWarning && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{progress.aiWarning}</span>
            </div>
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {progress.error ?? "An error occurred."}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          {!isDone && !isRunning && (
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
          )}
          {isDone && (
            <Button onClick={() => handleClose(false)}>Close</Button>
          )}
          {(isIdle || isError) && !noFile && !noAI && (
            <Button onClick={handleStart} disabled={isRunning} className="gap-1.5">
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isError ? "Retry" : "Place with AI"}
            </Button>
          )}
          {isRunning && (
            <Button disabled className="gap-1.5">
              <Loader2 className="h-4 w-4 animate-spin" />
              Placing…
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
