"use client";

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ImagePlus } from "lucide-react";

import { useStampsStore } from "@/stores/stamps";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NewImageStamp } from "@/types/stampify";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const imageStampSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Max 100 characters"),
});

type ImageStampFormValues = z.infer<typeof imageStampSchema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ImageStampFormProps {
  onStampCreated: () => void;
}

export function ImageStampForm({ onStampCreated }: ImageStampFormProps) {
  const addStamp = useStampsStore((s) => s.addStamp);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ImageStampFormValues>({
    resolver: zodResolver(imageStampSchema),
    defaultValues: {
      name: "",
    },
  });

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setImageFile(file);

      // Auto-fill name from filename (strip extension)
      const baseName = file.name.replace(/\.[^.]+$/, "");
      setValue("name", baseName, { shouldValidate: true });

      // Read as data URL for preview and to get dimensions
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setPreviewUrl(dataUrl);

        // Get image dimensions
        const img = new Image();
        img.onload = () => {
          setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },
    [setValue],
  );

  function onSubmit(values: ImageStampFormValues) {
    if (!previewUrl || !imageDimensions) {
      toast({ title: "No image selected", description: "Please upload an image first.", variant: "destructive" });
      return;
    }

    // For now, store the data URL as storageUrl (Firebase Storage upload will be added later)
    const newStamp: NewImageStamp = {
      type: "image",
      name: values.name,
      storageUrl: previewUrl,
      width: imageDimensions.width,
      height: imageDimensions.height,
    };

    addStamp(newStamp);
    toast({ title: "Image stamp created", description: `"${values.name}" has been added to your library.` });
    onStampCreated();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* File upload */}
      <div className="space-y-1.5">
        <Label htmlFor="is-file">Upload Image</Label>
        <div className="flex flex-col items-center gap-3">
          {previewUrl ? (
            <div className="relative w-full rounded-md border border-input p-2">
              <img
                src={previewUrl}
                alt="Stamp preview"
                className="mx-auto max-h-40 object-contain"
              />
            </div>
          ) : (
            <label
              htmlFor="is-file"
              className="flex h-32 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-input bg-muted/50 text-muted-foreground transition-colors hover:border-primary hover:bg-muted"
            >
              <ImagePlus className="h-8 w-8" />
              <span className="text-sm">Click to upload PNG or JPG</span>
            </label>
          )}
          <input
            id="is-file"
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            className={previewUrl ? "text-sm" : "sr-only"}
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="is-name">Name</Label>
        <Input id="is-name" placeholder="Stamp name" {...register("name")} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      {/* Dimensions info */}
      {imageDimensions && (
        <p className="text-xs text-muted-foreground">
          Dimensions: {imageDimensions.width} x {imageDimensions.height}px
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitting || !previewUrl}>
        Create Image Stamp
      </Button>
    </form>
  );
}
