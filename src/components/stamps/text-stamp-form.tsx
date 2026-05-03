"use client";

import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useStampActions } from "@/hooks/use-stamp-actions";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { renderStampToDataURL, createPreviewAppliedStamp } from "@/lib/pdf/stamp-renderer";
import type { StampTemplate, BlendMode, NewTextStamp, TextStamp } from "@/types/stampify";

const textStampSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Max 50 characters"),
  text: z.string().min(1, "Text is required").max(100, "Max 100 characters"),
  author: z.string().max(50, "Max 50 characters").optional().default(""),
  template: z.enum([
    "text",
    "text_with_border",
    "text_with_date_and_border",
    "text_with_rounded_border",
  ]) as z.ZodType<StampTemplate>,
  fontSize: z.number().min(8).max(144),
  blendMode: z.enum(["normal", "overlay"]) as z.ZodType<BlendMode>,
  opacity: z.number().min(0).max(100),
  rotation: z.number().min(0).max(360),
  fontColor: z.string(),
  lineColor: z.string(),
});

type TextStampFormValues = z.infer<typeof textStampSchema>;

interface TextStampFormProps {
  onStampCreated: () => void;
}

export function TextStampForm({ onStampCreated }: TextStampFormProps) {
  const { createStamp } = useStampActions();
  const previewImgRef = useRef<HTMLImageElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TextStampFormValues>({
    resolver: zodResolver(textStampSchema),
    defaultValues: {
      name: "",
      text: "APPROVED",
      author: "",
      template: "text_with_border",
      fontSize: 48,
      blendMode: "normal",
      opacity: 100,
      rotation: 0,
      fontColor: "#ff0000",
      lineColor: "#ff0000",
    },
  });

  const values = watch();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!values.text) return;
      const charWidth = (values.fontSize ?? 48) * 0.6;
      const w = Math.max(100, (values.text?.length ?? 6) * charWidth + 40);
      const h = Math.max(60, (values.fontSize ?? 48) * 1.5 + 20);

      const stamp: TextStamp = {
        id: "preview",
        type: "text",
        name: values.name || "preview",
        text: values.text || "STAMP",
        author: values.author ?? "",
        template: values.template ?? "text_with_border",
        fontSize: values.fontSize ?? 48,
        blendMode: values.blendMode ?? "normal",
        opacity: values.opacity ?? 100,
        rotation: values.rotation ?? 0,
        fontColor: values.fontColor ?? "#ff0000",
        lineColor: values.lineColor ?? "#ff0000",
        width: Math.round(w),
        height: Math.round(h),
      };

      try {
        const applied = createPreviewAppliedStamp(stamp);
        const dataUrl = await renderStampToDataURL(stamp, applied, { mode: "base", pixelRatio: 2 });
        if (previewImgRef.current) {
          previewImgRef.current.src = dataUrl;
        }
      } catch {
        // preview failed, ignore
      }
    }, 200);
  }, [values.text, values.fontSize, values.template, values.blendMode, values.opacity, values.rotation, values.fontColor, values.lineColor, values.name, values.author]);

  const fontSize = watch("fontSize");
  const opacity = watch("opacity");
  const rotation = watch("rotation");

  async function onSubmit(data: TextStampFormValues) {
    const charWidth = data.fontSize * 0.6;
    const estimatedWidth = Math.max(100, data.text.length * charWidth + 40);
    const estimatedHeight = Math.max(60, data.fontSize * 1.5 + 20);

    const newStamp: NewTextStamp = {
      type: "text",
      name: data.name,
      text: data.text,
      author: data.author ?? "",
      template: data.template,
      fontSize: data.fontSize,
      blendMode: data.blendMode,
      opacity: data.opacity,
      rotation: data.rotation,
      fontColor: data.fontColor,
      lineColor: data.lineColor,
      width: Math.round(estimatedWidth),
      height: Math.round(estimatedHeight),
    };

    const id = await createStamp(newStamp);
    if (id) {
      toast({ title: "Text stamp created", description: `"${data.name}" has been added to your library.` });
      onStampCreated();
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Live Preview */}
      <div className="flex items-center justify-center rounded-lg border bg-muted/30 p-4 min-h-[100px]">
        <img
          ref={previewImgRef}
          alt="Stamp preview"
          className="max-h-[80px] max-w-full object-contain"
          style={{ imageRendering: "pixelated" }}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ts-name">Name</Label>
        <Input id="ts-name" placeholder="My stamp" {...register("name")} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ts-text">Text</Label>
        <Input id="ts-text" placeholder="APPROVED" {...register("text")} />
        {errors.text && <p className="text-xs text-destructive">{errors.text.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ts-author">Author (optional)</Label>
        <Input id="ts-author" placeholder="John Doe" {...register("author")} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ts-template">Template</Label>
        <select
          id="ts-template"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          {...register("template")}
        >
          <option value="text">Text only</option>
          <option value="text_with_border">Text with Border</option>
          <option value="text_with_date_and_border">Text with Date &amp; Border</option>
          <option value="text_with_rounded_border">Text with Rounded Border</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ts-blendMode">Blend Mode</Label>
        <select
          id="ts-blendMode"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          {...register("blendMode")}
        >
          <option value="normal">Normal</option>
          <option value="overlay">Overlay</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <Label>Font Size: {fontSize}px</Label>
        <input type="range" min={8} max={144} className="w-full accent-primary" {...register("fontSize", { valueAsNumber: true })} />
      </div>

      <div className="space-y-1.5">
        <Label>Opacity: {opacity}%</Label>
        <input type="range" min={0} max={100} className="w-full accent-primary" {...register("opacity", { valueAsNumber: true })} />
      </div>

      <div className="space-y-1.5">
        <Label>Rotation: {rotation}°</Label>
        <input type="range" min={0} max={360} className="w-full accent-primary" {...register("rotation", { valueAsNumber: true })} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="ts-fontColor">Font Color</Label>
          <input id="ts-fontColor" type="color" className="h-10 w-full cursor-pointer rounded-md border border-input" {...register("fontColor")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ts-lineColor">Line Color</Label>
          <input id="ts-lineColor" type="color" className="h-10 w-full cursor-pointer rounded-md border border-input" {...register("lineColor")} />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create Text Stamp"}
      </Button>
    </form>
  );
}
