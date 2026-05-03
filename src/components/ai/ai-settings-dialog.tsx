"use client";

import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { AIProviderConfig, AIProviderType } from "@/types/stampify";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useSettingsStore, selectActiveAIConfig } from "@/stores/settings";
import { toast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Default models per provider type
// ---------------------------------------------------------------------------

const DEFAULT_MODELS: Record<AIProviderType, string> = {
  azure: "",
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-20250514",
};

const PROVIDER_LABELS: Record<AIProviderType, string> = {
  azure: "Azure OpenAI",
  openai: "OpenAI",
  anthropic: "Anthropic",
};

// ---------------------------------------------------------------------------
// Empty form state
// ---------------------------------------------------------------------------

function emptyForm(type: AIProviderType = "openai"): AIProviderConfig {
  return {
    type,
    apiKey: "",
    endpoint: "",
    model: DEFAULT_MODELS[type],
    isDefault: false,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface AISettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AISettingsDialog({ open, onOpenChange }: AISettingsDialogProps) {
  const {
    settings,
    addProvider,
    updateProvider,
    removeProvider,
    setActiveProvider,
  } = useSettingsStore();

  const activeConfig = useSettingsStore(selectActiveAIConfig);
  const providers = settings.ai.providers;

  // Form state
  const [showForm, setShowForm] = React.useState(false);
  const [editIndex, setEditIndex] = React.useState<number | null>(null);
  const [form, setForm] = React.useState<AIProviderConfig>(emptyForm());
  const [testing, setTesting] = React.useState(false);

  // Reset form when dialog closes
  React.useEffect(() => {
    if (!open) {
      setShowForm(false);
      setEditIndex(null);
      setForm(emptyForm());
    }
  }, [open]);

  // ------- helpers -------

  function handleTypeChange(type: AIProviderType) {
    setForm((prev) => ({
      ...prev,
      type,
      model: prev.model || DEFAULT_MODELS[type],
      endpoint: type === "azure" ? prev.endpoint : "",
    }));
  }

  function handleFieldChange(field: keyof AIProviderConfig, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleEdit(index: number) {
    setForm({ ...providers[index] });
    setEditIndex(index);
    setShowForm(true);
  }

  function handleDelete(index: number) {
    removeProvider(index);
    toast({ title: "Provider removed" });
  }

  function handleCancel() {
    setShowForm(false);
    setEditIndex(null);
    setForm(emptyForm());
  }

  function handleSave() {
    // Validation
    if (form.type === "azure" && !form.endpoint?.trim()) {
      toast({
        title: "Validation error",
        description: "Azure provider requires an endpoint.",
        variant: "destructive",
      });
      return;
    }

    if (editIndex !== null) {
      updateProvider(editIndex, form);
      toast({ title: "Provider updated" });
    } else {
      addProvider(form);
      toast({ title: "Provider added" });
    }

    // If this is the first provider, auto-activate it
    if (providers.length === 0 && editIndex === null) {
      setActiveProvider(form.type);
    }

    handleCancel();
  }

  async function handleTestConnection() {
    if (!form.apiKey) {
      toast({
        title: "Missing API key",
        description: "Please enter an API key before testing.",
        variant: "destructive",
      });
      return;
    }

    if (form.type === "azure" && !form.endpoint?.trim()) {
      toast({
        title: "Missing endpoint",
        description: "Azure provider requires an endpoint.",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: form,
          messages: [
            {
              role: "user" as const,
              content: "Reply with exactly: OK",
            },
          ],
          maxTokens: 10,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      toast({ title: "Connection successful", description: "The AI provider responded correctly." });
    } catch (err) {
      toast({
        title: "Connection failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  }

  function handleSetActive(type: AIProviderType) {
    setActiveProvider(type);
    toast({ title: `${PROVIDER_LABELS[type]} set as active provider` });
  }

  // ------- render -------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>AI Provider Settings</DialogTitle>
          <DialogDescription>
            Configure AI providers for stamp generation.
          </DialogDescription>
        </DialogHeader>

        {/* Provider list */}
        {providers.length > 0 && !showForm && (
          <div className="space-y-2">
            {providers.map((p, i) => (
              <div
                key={`${p.type}-${i}`}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="activeProvider"
                    checked={settings.ai.activeProvider === p.type}
                    onChange={() => handleSetActive(p.type)}
                    className="h-4 w-4"
                  />
                  <div>
                    <p className="text-sm font-medium">
                      {PROVIDER_LABELS[p.type]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Model: {p.model || "(default)"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(i)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(i)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add / Edit form */}
        {showForm ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="provider-type">Provider Type</Label>
              <Select
                id="provider-type"
                value={form.type}
                onChange={(e) =>
                  handleTypeChange(e.target.value as AIProviderType)
                }
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="azure">Azure OpenAI</option>
              </Select>
            </div>

            {/* Azure-specific: endpoint */}
            {form.type === "azure" && (
              <div className="space-y-2">
                <Label htmlFor="provider-endpoint">
                  Endpoint <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="provider-endpoint"
                  placeholder="https://your-resource.openai.azure.com"
                  value={form.endpoint ?? ""}
                  onChange={(e) => handleFieldChange("endpoint", e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="provider-apikey">API Key</Label>
              <Input
                id="provider-apikey"
                type="password"
                placeholder="sk-..."
                value={form.apiKey}
                onChange={(e) => handleFieldChange("apiKey", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider-model">
                {form.type === "azure" ? "Deployment Name" : "Model"}
              </Label>
              <Input
                id="provider-model"
                placeholder={DEFAULT_MODELS[form.type] || "deployment-name"}
                value={form.model}
                onChange={(e) => handleFieldChange("model", e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={testing}
              >
                {testing ? "Testing..." : "Test Connection"}
              </Button>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                {editIndex !== null ? "Update" : "Save"}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setForm(emptyForm());
              setEditIndex(null);
              setShowForm(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Provider
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
