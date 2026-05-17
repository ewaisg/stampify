"use client";

import {
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { StampPreview } from "@/components/stamps/stamp-preview";
import { toast } from "@/hooks/use-toast";
import { useStampActions } from "@/hooks/use-stamp-actions";
import { useStampsStore } from "@/stores/stamps";
import {
  createCustomPreparedStamp,
  createCustomStampTemplateData,
  CUSTOM_STAMP_PRESETS,
  isCustomBlockStamp,
  resolveCustomStampData,
  type CustomStampAlign,
  type CustomStampBlock,
  type CustomStampBlockType,
  type CustomStampDateBlock,
  type CustomStampFontWeight,
  type CustomStampLabelValueBlock,
  type CustomStampLogoBlock,
  type CustomStampLogoKind,
  type CustomStampSignatureBlock,
  type CustomStampTemplateData,
  type CustomStampTextBlock,
} from "@/lib/stamps/custom-template";
import type { PreparedStamp } from "@/types/stampify";

interface CustomStampBuilderFormProps {
  stamp?: PreparedStamp;
  onComplete: () => void;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_SIDE = 512;
const CUSTOM_STATE_VALUE = "__custom-state__";
const US_STATES = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
] as const;

function newBlockId(): string {
  return crypto.randomUUID();
}

function cloneBlocks(blocks: CustomStampBlock[]): CustomStampBlock[] {
  return blocks.map((block) => ({ ...block, id: newBlockId() }));
}

function defaultData(): CustomStampTemplateData {
  const preset = CUSTOM_STAMP_PRESETS[1] ?? CUSTOM_STAMP_PRESETS[0];
  return createCustomStampTemplateData({
    state: preset.state,
    purpose: preset.purpose,
    width: preset.width,
    height: preset.height,
    padding: preset.padding,
    backgroundColor: preset.backgroundColor,
    blocks: cloneBlocks(preset.blocks),
  });
}

function createBlock(type: CustomStampBlockType): CustomStampBlock {
  const id = newBlockId();

  switch (type) {
    case "logo":
      return {
        id,
        type,
        logoKind: "intertek-mark",
        width: 78,
        height: 78,
        align: "left",
        marginBottom: 8,
      };
    case "text":
      return {
        id,
        type,
        text: "Approved",
        color: "#ff0000",
        fontSize: 16,
        fontWeight: "bold",
        italic: true,
        align: "left",
        lineHeight: 1.25,
      };
    case "labelValue":
      return {
        id,
        type,
        label: "Plan #:",
        value: "R-00000",
        color: "#111111",
        labelColor: "#111111",
        fontSize: 13,
        labelWeight: "bold",
        valueWeight: "normal",
        italic: false,
        labelWidth: 96,
      };
    case "date":
      return {
        id,
        type,
        label: "Approval Date:",
        value: new Date().toISOString().slice(0, 10),
        color: "#111111",
        fontSize: 14,
        fontWeight: "normal",
        italic: false,
        align: "left",
      };
    case "signature":
      return {
        id,
        type,
        signerName: "Reviewer Name",
        width: 150,
        height: 42,
        color: "#111111",
        fontSize: 18,
        align: "left",
      };
    case "spacer":
      return {
        id,
        type,
        height: 12,
      };
  }
}

function resizeImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Image file could not be read."));
    reader.onload = (event) => {
      const source = event.target?.result;
      if (typeof source !== "string") {
        reject(new Error("Image file could not be read."));
        return;
      }

      const image = new Image();
      image.onerror = () => reject(new Error("Image file could not be loaded."));
      image.onload = () => {
        const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
        const scale = largestSide > MAX_IMAGE_SIDE ? MAX_IMAGE_SIDE / largestSide : 1;
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Image file could not be processed."));
          return;
        }

        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/png"));
      };
      image.src = source;
    };

    reader.readAsDataURL(file);
  });
}

export function CustomStampBuilderForm({
  stamp,
  onComplete,
}: CustomStampBuilderFormProps) {
  const { createStamp, editStamp } = useStampActions();
  const stamps = useStampsStore((s) => s.stamps);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
  const [newBlockType, setNewBlockType] = useState<CustomStampBlockType>("text");
  const [data, setData] = useState<CustomStampTemplateData>(() =>
    stamp && isCustomBlockStamp(stamp) ? resolveCustomStampData(stamp) : defaultData(),
  );

  const stateOptions = useMemo(() => {
    const states = new Set<string>(["General", ...US_STATES]);
    for (const existing of stamps) {
      if (isCustomBlockStamp(existing)) {
        states.add(resolveCustomStampData(existing).state);
      }
    }
    for (const preset of CUSTOM_STAMP_PRESETS) {
      states.add(preset.state);
    }
    return [...states].sort((a, b) => a.localeCompare(b));
  }, [stamps]);
  const stateSelectValue = stateOptions.includes(data.state)
    ? data.state
    : CUSTOM_STATE_VALUE;

  const previewStamp = useMemo(
    () => ({
      ...createCustomPreparedStamp(data),
      id: stamp?.id ?? "preview-custom-builder",
    }),
    [data, stamp?.id],
  );

  function updateData(patch: Partial<CustomStampTemplateData>) {
    setData((current) => ({ ...current, ...patch }));
  }

  function updateBlock(blockId: string, patch: Partial<CustomStampBlock>) {
    setData((current) => ({
      ...current,
      blocks: current.blocks.map((block) =>
        block.id === blockId ? ({ ...block, ...patch } as CustomStampBlock) : block,
      ),
    }));
  }

  function removeBlock(blockId: string) {
    setData((current) => ({
      ...current,
      blocks: current.blocks.filter((block) => block.id !== blockId),
    }));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    setData((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.blocks.length) return current;

      const blocks = [...current.blocks];
      const [block] = blocks.splice(index, 1);
      blocks.splice(nextIndex, 0, block);

      return { ...current, blocks };
    });
  }

  function applyPreset(presetId: string) {
    const preset = CUSTOM_STAMP_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;

    setData(
      createCustomStampTemplateData({
        state: preset.state,
        purpose: preset.purpose,
        width: preset.width,
        height: preset.height,
        padding: preset.padding,
        backgroundColor: preset.backgroundColor,
        blocks: cloneBlocks(preset.blocks),
      }),
    );
  }

  async function handleImageUpload(
    blockId: string,
    target: "logo" | "signature",
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Image not supported",
        description: "Upload a PNG, JPG, or WEBP image.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      toast({
        title: "Image is too large",
        description: "Upload an image smaller than 5 MB.",
        variant: "destructive",
      });
      return;
    }

    setUploadingBlockId(blockId);
    try {
      const dataUrl = await resizeImageFile(file);
      if (target === "logo") {
        updateBlock(blockId, {
          logoKind: "uploaded",
          imageDataUrl: dataUrl,
        } as Partial<CustomStampLogoBlock>);
      } else {
        updateBlock(blockId, {
          imageDataUrl: dataUrl,
        } as Partial<CustomStampSignatureBlock>);
      }
    } catch (error) {
      console.error("[CustomStampBuilderForm] Failed to load image:", error);
      toast({
        title: "Image failed",
        description: "The image could not be loaded.",
        variant: "destructive",
      });
    } finally {
      setUploadingBlockId(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!data.state.trim() || !data.purpose.trim()) {
      toast({
        title: "Missing stamp details",
        description: "Add a state and stamp name before saving.",
        variant: "destructive",
      });
      return;
    }

    if (data.blocks.length === 0) {
      toast({
        title: "No stamp blocks",
        description: "Add at least one block before saving.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const cleanData = createCustomStampTemplateData({
        state: data.state,
        purpose: data.purpose,
        width: data.width,
        height: data.height,
        backgroundColor: data.backgroundColor,
        padding: data.padding,
        blocks: data.blocks,
      });
      const nextStamp = createCustomPreparedStamp(cleanData);

      if (stamp) {
        const ok = await editStamp(stamp.id, {
          ...nextStamp,
          name: nextStamp.name,
          width: nextStamp.width,
          height: nextStamp.height,
          backgroundColor: nextStamp.backgroundColor,
          data: nextStamp.data,
          fields: nextStamp.fields,
          templateId: nextStamp.templateId,
        });
        if (ok) {
          toast({
            title: "Template updated",
            description: `"${nextStamp.name}" has been updated.`,
          });
          onComplete();
        }
      } else {
        const id = await createStamp(nextStamp);
        if (id) {
          toast({
            title: "Template saved",
            description: `"${nextStamp.name}" was added to your library.`,
          });
          onComplete();
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  function renderLogoBlock(block: CustomStampLogoBlock) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Logo</Label>
          <Select
            className="h-9"
            value={block.logoKind}
            onChange={(e) =>
              updateBlock(block.id, {
                logoKind: e.target.value as CustomStampLogoKind,
              } as Partial<CustomStampLogoBlock>)
            }
          >
            <option value="intertek-mark">Intertek mark</option>
            <option value="intertek-wordmark">Intertek wordmark</option>
            <option value="uploaded">Uploaded image</option>
          </Select>
        </div>
        <NumberInput
          label="Width"
          value={block.width}
          min={24}
          max={260}
          onChange={(value) => updateBlock(block.id, { width: value })}
        />
        <NumberInput
          label="Height"
          value={block.height}
          min={24}
          max={180}
          onChange={(value) => updateBlock(block.id, { height: value })}
        />

        <AlignSelect
          value={block.align}
          onChange={(align) => updateBlock(block.id, { align })}
        />

        <div className="space-y-1 sm:col-span-2">
          <Label className="text-xs">Upload logo</Label>
          <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground">
            {uploadingBlockId === block.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
            {block.imageDataUrl ? "Replace image" : "Upload image"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="sr-only"
              disabled={uploadingBlockId === block.id}
              onChange={(e) => handleImageUpload(block.id, "logo", e)}
            />
          </label>
        </div>
      </div>
    );
  }

  function renderTextBlock(block: CustomStampTextBlock) {
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Text</Label>
          <textarea
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            value={block.text}
            onChange={(e) => updateBlock(block.id, { text: e.target.value })}
          />
        </div>
        <TextStyleControls
          align={block.align}
          color={block.color}
          fontSize={block.fontSize}
          fontWeight={block.fontWeight}
          italic={block.italic}
          onChange={(patch) => updateBlock(block.id, patch)}
        />
      </div>
    );
  }

  function renderLabelValueBlock(block: CustomStampLabelValueBlock) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextInput
            label="Label"
            value={block.label}
            onChange={(value) => updateBlock(block.id, { label: value })}
          />
          <TextInput
            label="Value"
            value={block.value}
            onChange={(value) => updateBlock(block.id, { value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumberInput
            label="Font size"
            value={block.fontSize}
            min={8}
            max={48}
            onChange={(value) => updateBlock(block.id, { fontSize: value })}
          />
          <NumberInput
            label="Label width"
            value={block.labelWidth}
            min={40}
            max={220}
            onChange={(value) => updateBlock(block.id, { labelWidth: value })}
          />
          <ColorInput
            label="Label color"
            value={block.labelColor}
            onChange={(value) => updateBlock(block.id, { labelColor: value })}
          />
          <ColorInput
            label="Value color"
            value={block.color}
            onChange={(value) => updateBlock(block.id, { color: value })}
          />
        </div>
      </div>
    );
  }

  function renderDateBlock(block: CustomStampDateBlock) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextInput
          label="Label"
          value={block.label}
          onChange={(value) => updateBlock(block.id, { label: value })}
        />
        <div className="space-y-1">
          <Label className="text-xs">Date</Label>
          <Input
            type="date"
            className="h-9"
            value={block.value}
            onChange={(e) => updateBlock(block.id, { value: e.target.value })}
          />
        </div>
        <TextStyleControls
          align={block.align}
          color={block.color}
          fontSize={block.fontSize}
          fontWeight={block.fontWeight}
          italic={block.italic}
          onChange={(patch) => updateBlock(block.id, patch)}
        />
      </div>
    );
  }

  function renderSignatureBlock(block: CustomStampSignatureBlock) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextInput
          label="Signer"
          value={block.signerName}
          onChange={(value) => updateBlock(block.id, { signerName: value })}
        />
        <NumberInput
          label="Width"
          value={block.width}
          min={80}
          max={260}
          onChange={(value) => updateBlock(block.id, { width: value })}
        />
        <NumberInput
          label="Height"
          value={block.height}
          min={20}
          max={120}
          onChange={(value) => updateBlock(block.id, { height: value })}
        />
        <AlignSelect
          value={block.align}
          onChange={(align) => updateBlock(block.id, { align })}
        />
        <ColorInput
          label="Color"
          value={block.color}
          onChange={(value) => updateBlock(block.id, { color: value })}
        />
        <div className="space-y-1">
          <Label className="text-xs">Signature image</Label>
          <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground">
            {uploadingBlockId === block.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
            {block.imageDataUrl ? "Replace" : "Upload"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="sr-only"
              disabled={uploadingBlockId === block.id}
              onChange={(e) => handleImageUpload(block.id, "signature", e)}
            />
          </label>
        </div>
      </div>
    );
  }

  function renderBlockEditor(block: CustomStampBlock, index: number) {
    return (
      <div key={block.id} className="rounded-md border bg-card p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium capitalize">
              {block.type === "labelValue" ? "Label / value" : block.type}
            </p>
            <p className="text-xs text-muted-foreground">Block {index + 1}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={index === 0}
              onClick={() => moveBlock(index, -1)}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={index === data.blocks.length - 1}
              onClick={() => moveBlock(index, 1)}
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => removeBlock(block.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {block.type === "logo" && renderLogoBlock(block)}
        {block.type === "text" && renderTextBlock(block)}
        {block.type === "labelValue" && renderLabelValueBlock(block)}
        {block.type === "date" && renderDateBlock(block)}
        {block.type === "signature" && renderSignatureBlock(block)}
        {block.type === "spacer" && (
          <NumberInput
            label="Height"
            value={block.height}
            min={4}
            max={80}
            onChange={(value) => updateBlock(block.id, { height: value })}
          />
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3 lg:sticky lg:top-0 lg:self-start">
          <div
            className="rounded-md border p-4 shadow-sm"
            style={{
              backgroundColor: "#f8fafc",
              backgroundImage:
                "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
              backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
              backgroundSize: "16px 16px",
            }}
          >
            <StampPreview
              stamp={previewStamp}
              className="mx-auto h-72 w-full object-contain"
            />
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <section className="space-y-3 rounded-md border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Template</p>
              <Select
                className="h-8 max-w-56 text-xs"
                value=""
                onChange={(e) => applyPreset(e.target.value)}
              >
                <option value="" disabled>
                  Load preset
                </option>
                {CUSTOM_STAMP_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="custom-state" className="text-xs">
                  State / collection
                </Label>
                <Select
                  id="custom-state"
                  className="h-9"
                  value={stateSelectValue}
                  onChange={(e) => {
                    const value = e.target.value;
                    updateData({
                      state: value === CUSTOM_STATE_VALUE ? "" : value,
                    });
                  }}
                >
                  {stateOptions.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                  <option value={CUSTOM_STATE_VALUE}>New state / collection...</option>
                </Select>
                {stateSelectValue === CUSTOM_STATE_VALUE && (
                  <Input
                    className="h-9"
                    placeholder="Type state or collection name"
                    value={data.state}
                    onChange={(e) => updateData({ state: e.target.value })}
                  />
                )}
              </div>
              <TextInput
                id="custom-purpose"
                label="Stamp name / purpose"
                value={data.purpose}
                onChange={(value) => updateData({ purpose: value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumberInput
                label="Width"
                value={data.width}
                min={120}
                max={700}
                onChange={(value) => updateData({ width: value })}
              />
              <NumberInput
                label="Height"
                value={data.height}
                min={80}
                max={700}
                onChange={(value) => updateData({ height: value })}
              />
              <NumberInput
                label="Padding"
                value={data.padding}
                min={0}
                max={60}
                onChange={(value) => updateData({ padding: value })}
              />
              <ColorInput
                label="Background"
                value={
                  data.backgroundColor === "transparent"
                    ? "#ffffff"
                    : data.backgroundColor
                }
                onChange={(value) => updateData({ backgroundColor: value })}
              />
            </div>
          </section>

          <section className="space-y-3 rounded-md border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Blocks</p>
              <div className="flex gap-2">
                <Select
                  className="h-9 w-40"
                  value={newBlockType}
                  onChange={(e) =>
                    setNewBlockType(e.target.value as CustomStampBlockType)
                  }
                >
                  <option value="logo">Logo</option>
                  <option value="text">Text</option>
                  <option value="labelValue">Label / value</option>
                  <option value="date">Date</option>
                  <option value="signature">Signature</option>
                  <option value="spacer">Spacer</option>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() =>
                    updateData({ blocks: [...data.blocks, createBlock(newBlockType)] })
                  }
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {data.blocks.map((block, index) => renderBlockEditor(block, index))}
            </div>
          </section>
        </div>
      </div>

      <Button
        type="submit"
        className="h-10 w-full"
        disabled={submitting || uploadingBlockId !== null}
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : stamp ? (
          "Update Template"
        ) : (
          "Save Template"
        )}
      </Button>
    </form>
  );
}

function TextInput({
  id,
  label,
  value,
  onChange,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        className="h-9"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        className="h-9"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <input
        type="color"
        className="h-9 w-full cursor-pointer rounded-md border border-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function AlignSelect({
  value,
  onChange,
}: {
  value: CustomStampAlign;
  onChange: (value: CustomStampAlign) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">Align</Label>
      <Select
        className="h-9"
        value={value}
        onChange={(e) => onChange(e.target.value as CustomStampAlign)}
      >
        <option value="left">Left</option>
        <option value="center">Center</option>
        <option value="right">Right</option>
      </Select>
    </div>
  );
}

function TextStyleControls({
  align,
  color,
  fontSize,
  fontWeight,
  italic,
  onChange,
}: {
  align: CustomStampAlign;
  color: string;
  fontSize: number;
  fontWeight: CustomStampFontWeight;
  italic: boolean;
  onChange: (patch: Partial<CustomStampTextBlock | CustomStampDateBlock>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <NumberInput
        label="Font size"
        value={fontSize}
        min={8}
        max={64}
        onChange={(value) => onChange({ fontSize: value })}
      />
      <ColorInput
        label="Color"
        value={color}
        onChange={(value) => onChange({ color: value })}
      />
      <AlignSelect value={align} onChange={(value) => onChange({ align: value })} />
      <div className="space-y-1">
        <Label className="text-xs">Weight</Label>
        <Select
          className="h-9"
          value={fontWeight}
          onChange={(e) =>
            onChange({ fontWeight: e.target.value as CustomStampFontWeight })
          }
        >
          <option value="normal">Normal</option>
          <option value="bold">Bold</option>
        </Select>
      </div>
      <label className="flex h-full min-h-14 items-end gap-2 pb-2 text-sm">
        <input
          type="checkbox"
          checked={italic}
          onChange={(e) => onChange({ italic: e.target.checked })}
        />
        Italic
      </label>
    </div>
  );
}
