"use client";

import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { NewTextStamp } from "@/types/stampify";
import type { AICompletionResponse } from "@/lib/ai/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettingsStore, selectActiveAIConfig } from "@/stores/settings";
import { useStampsStore } from "@/stores/stamps";
import { toast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a stamp configuration generator for a PDF stamping application called Stampify.

Given a natural language description, produce a JSON object matching the TextStamp schema (without the "id" field). The JSON must be valid and contain nothing else -- no markdown fences, no explanation.

Field definitions:
- type: always "text"
- name: a short descriptive name for the stamp
- text: the stamp text to display (e.g. "CONFIDENTIAL", "APPROVED")
- author: leave as empty string ""
- template: one of "text", "text_with_border", "text_with_date_and_border", "text_with_rounded_border"
- width: number (100-600), default 200
- height: number (50-300), default 80
- blendMode: "normal" or "overlay"
- opacity: number 0-100, default 80
- rotation: number 0-360 in degrees, default 0
- fontColor: CSS hex color string (e.g. "#FF0000")
- lineColor: CSS hex color string for the border (e.g. "#FF0000")
- fontSize: number (8-72), default 24

Choose sensible defaults when the user does not specify a value. Always return valid JSON only.`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface AIStampGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AIStampGenerator({ open, onOpenChange }: AIStampGeneratorProps) {
  const activeConfig = useSettingsStore(selectActiveAIConfig);
  const addStamp = useStampsStore((s) => s.addStamp);

  const [prompt, setPrompt] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [generated, setGenerated] = React.useState<NewTextStamp | null>(null);
  const [rawResponse, setRawResponse] = React.useState<string>("");

  // Reset when dialog closes
  React.useEffect(() => {
    if (!open) {
      setPrompt("");
      setGenerated(null);
      setRawResponse("");
    }
  }, [open]);

  // ------- handlers -------

  async function handleGenerate() {
    if (!prompt.trim()) {
      toast({
        title: "Empty prompt",
        description: "Please describe the stamp you want to create.",
        variant: "destructive",
      });
      return;
    }

    if (!activeConfig) {
      toast({
        title: "No AI provider configured",
        description:
          "Open Settings to configure and activate an AI provider first.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setGenerated(null);
    setRawResponse("");

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: activeConfig,
          messages: [
            { role: "system" as const, content: SYSTEM_PROMPT },
            { role: "user" as const, content: prompt },
          ],
          // Do not send temperature — some models (Azure o-series) only accept the default
          maxTokens: 1024,
          responseFormat: "json",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const completion: AICompletionResponse = await res.json();
      setRawResponse(completion.content);

      // Try to parse the JSON from the response content
      const parsed = parseStampJson(completion.content);
      setGenerated(parsed);
    } catch (err) {
      toast({
        title: "Generation failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleUseStamp() {
    if (!generated) return;
    addStamp(generated);
    toast({ title: "Stamp added", description: `"${generated.name}" has been added to your stamps.` });
    onOpenChange(false);
  }

  // ------- render -------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>AI Stamp Generator</DialogTitle>
          <DialogDescription>
            Describe the stamp you want and let AI generate the configuration.
          </DialogDescription>
        </DialogHeader>

        {!activeConfig && (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            No active AI provider. Please configure one in Settings first.
          </p>
        )}

        {/* Prompt input */}
        <div className="space-y-2">
          <Label htmlFor="ai-prompt">Description</Label>
          <Input
            id="ai-prompt"
            placeholder='e.g. "Red CONFIDENTIAL stamp with border, 45 degree angle"'
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !loading) {
                e.preventDefault();
                handleGenerate();
              }
            }}
            disabled={loading}
          />
        </div>

        <Button
          onClick={handleGenerate}
          disabled={loading || !activeConfig}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate
            </>
          )}
        </Button>

        {/* Preview */}
        {generated && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Preview</h4>
            <div className="rounded-md border bg-muted/50 p-4">
              {/* Visual preview */}
              <div className="mb-4 flex items-center justify-center">
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: Math.min(generated.width, 400),
                    height: Math.min(generated.height, 200),
                    border:
                      generated.template !== "text"
                        ? `2px solid ${generated.lineColor}`
                        : "none",
                    borderRadius:
                      generated.template === "text_with_rounded_border"
                        ? "8px"
                        : "0px",
                    transform: `rotate(${generated.rotation}deg)`,
                    opacity: generated.opacity / 100,
                    color: generated.fontColor,
                    fontSize: `${generated.fontSize}px`,
                    fontWeight: "bold",
                  }}
                >
                  {generated.text}
                </div>
              </div>

              {/* Config details */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Name:</span>
                <span className="font-medium text-foreground">
                  {generated.name}
                </span>
                <span>Template:</span>
                <span className="font-medium text-foreground">
                  {generated.template}
                </span>
                <span>Size:</span>
                <span className="font-medium text-foreground">
                  {generated.width} x {generated.height}
                </span>
                <span>Rotation:</span>
                <span className="font-medium text-foreground">
                  {generated.rotation}&deg;
                </span>
                <span>Opacity:</span>
                <span className="font-medium text-foreground">
                  {generated.opacity}%
                </span>
                <span>Font Color:</span>
                <span className="font-medium text-foreground">
                  {generated.fontColor}
                </span>
                <span>Line Color:</span>
                <span className="font-medium text-foreground">
                  {generated.lineColor}
                </span>
                <span>Blend Mode:</span>
                <span className="font-medium text-foreground">
                  {generated.blendMode}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Error display for unparseable response */}
        {rawResponse && !generated && !loading && (
          <div className="space-y-2">
            <p className="text-sm text-destructive">
              Could not parse the AI response as a valid stamp configuration.
            </p>
            <pre className="max-h-32 overflow-auto rounded-md border bg-muted p-2 text-xs">
              {rawResponse}
            </pre>
          </div>
        )}

        {generated && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerated(null)}>
              Discard
            </Button>
            <Button onClick={handleUseStamp}>Use This Stamp</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseStampJson(raw: string): NewTextStamp {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  const parsed = JSON.parse(cleaned);

  // Validate required fields and coerce types
  const stamp: NewTextStamp = {
    type: "text",
    name: typeof parsed.name === "string" ? parsed.name : "AI Generated Stamp",
    text: typeof parsed.text === "string" ? parsed.text : "STAMP",
    author: typeof parsed.author === "string" ? parsed.author : "",
    template: isValidTemplate(parsed.template) ? parsed.template : "text_with_border",
    width: clamp(Number(parsed.width) || 200, 50, 800),
    height: clamp(Number(parsed.height) || 80, 30, 400),
    blendMode: parsed.blendMode === "overlay" ? "overlay" : "normal",
    opacity: clamp(Number(parsed.opacity) ?? 80, 0, 100),
    rotation: clamp(Number(parsed.rotation) ?? 0, 0, 360),
    fontColor: typeof parsed.fontColor === "string" ? parsed.fontColor : "#FF0000",
    lineColor: typeof parsed.lineColor === "string" ? parsed.lineColor : "#FF0000",
    fontSize: clamp(Number(parsed.fontSize) || 24, 8, 72),
  };

  return stamp;
}

function isValidTemplate(
  v: unknown,
): v is "text" | "text_with_border" | "text_with_date_and_border" | "text_with_rounded_border" {
  return (
    v === "text" ||
    v === "text_with_border" ||
    v === "text_with_date_and_border" ||
    v === "text_with_rounded_border"
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
