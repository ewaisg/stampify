"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { useStampActions } from "@/hooks/use-stamp-actions";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StampTemplate, BlendMode, NewTextStamp } from "@/types/stampify";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TextStampFormProps {
  onStampCreated: () => void;
}

export function TextStampForm({ onStampCreated }: TextStampFormProps) {
  const { createStamp } = useStampActions();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TextStampFormValues>({
    resolver: zodResolver(textStampSchema),
    defaultValues: {
      name: "",
      text: "",
      author: "",
      template: "text",
      fontSize: 48,
      blendMode: "normal",
      opacity: 100,
      rotation: 0,
      fontColor: "#ff0000",
      lineColor: "#ff0000",
    },
  });

  const fontSize = watch("fontSize");
  const opacity = watch("opacity");
  const rotation = watch("rotation");

  async function onSubmit(values: TextStampFormValues) {
    // Estimate dimensions from text length and font size
    const charWidth = values.fontSize * 0.6;
    const estimatedWidth = Math.max(100, values.text.length * charWidth + 40);
    const estimatedHeight = Math.max(60, values.fontSize * 1.5 + 20);

    const newStamp: NewTextStamp = {
      type: "text",
      name: values.name,
      text: values.text,
      author: values.author ?? "",
      template: values.template,
      fontSize: values.fontSize,
      blendMode: values.blendMode,
      opacity: values.opacity,
      rotation: values.rotation,
      fontColor: values.fontColor,
      lineColor: values.lineColor,
      width: Math.round(estimatedWidth),
      height: Math.round(estimatedHeight),
    };

    const id = await createStamp(newStamp);
    if (id) {
      toast({ title: "Text stamp created", description: `"${values.name}" has been added to your library.` });
      onStampCreated();
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="ts-name">Name</Label>
        <Input id="ts-name" placeholder="My stamp" {...register("name")} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      {/* Text */}
      <div className="space-y-1.5">
        <Label htmlFor="ts-text">Text</Label>
        <Input id="ts-text" placeholder="APPROVED" {...register("text")} />
        {errors.text && <p className="text-xs text-destructive">{errors.text.message}</p>}
      </div>

      {/* Author */}
      <div className="space-y-1.5">
        <Label htmlFor="ts-author">Author (optional)</Label>
        <Input id="ts-author" placeholder="John Doe" {...register("author")} />
        {errors.author && <p className="text-xs text-destructive">{errors.author.message}</p>}
      </div>

      {/* Template */}
      <div className="space-y-1.5">
        <Label htmlFor="ts-template">Template</Label>
        <select
          id="ts-template"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          {...register("template")}
        >
          <option value="text">Text</option>
          <option value="text_with_border">Text with Border</option>
          <option value="text_with_date_and_border">Text with Date & Border</option>
          <option value="text_with_rounded_border">Text with Rounded Border</option>
        </select>
      </div>

      {/* Font Size */}
      <div className="space-y-1.5">
        <Label htmlFor="ts-fontSize">Font Size: {fontSize}px</Label>
        <input
          id="ts-fontSize"
          type="range"
          min={8}
          max={144}
          className="w-full accent-primary"
          {...register("fontSize", { valueAsNumber: true })}
        />
      </div>

      {/* Blend Mode */}
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

      {/* Opacity */}
      <div className="space-y-1.5">
        <Label htmlFor="ts-opacity">Opacity: {opacity}%</Label>
        <input
          id="ts-opacity"
          type="range"
          min={0}
          max={100}
          className="w-full accent-primary"
          {...register("opacity", { valueAsNumber: true })}
        />
      </div>

      {/* Rotation */}
      <div className="space-y-1.5">
        <Label htmlFor="ts-rotation">Rotation: {rotation}°</Label>
        <input
          id="ts-rotation"
          type="range"
          min={0}
          max={360}
          className="w-full accent-primary"
          {...register("rotation", { valueAsNumber: true })}
        />
      </div>

      {/* Colors */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="ts-fontColor">Font Color</Label>
          <input
            id="ts-fontColor"
            type="color"
            className="h-10 w-full cursor-pointer rounded-md border border-input"
            {...register("fontColor")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ts-lineColor">Line Color</Label>
          <input
            id="ts-lineColor"
            type="color"
            className="h-10 w-full cursor-pointer rounded-md border border-input"
            {...register("lineColor")}
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        Create Text Stamp
      </Button>
    </form>
  );
}
