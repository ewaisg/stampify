"use client";

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { ImagePlus } from "lucide-react";

import { useStampsStore } from "@/stores/stamps";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DynamicStamp, PreparedStamp, DynamicField, NewPreparedStamp } from "@/types/stampify";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PrepareStampFormProps {
  template: DynamicStamp | PreparedStamp;
  onStampPrepared: (preparedId?: string) => void;
}

export function PrepareStampForm({ template, onStampPrepared }: PrepareStampFormProps) {
  const { addStamp, updateStamp } = useStampsStore();

  const isEditing = template.type === "prepared";
  const existingData = isEditing ? (template as PreparedStamp).data : {};

  // Track per-field data values
  const [fieldData, setFieldData] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    for (const field of template.fields) {
      if (existingData[field.id] !== undefined) {
        initial[field.id] = existingData[field.id];
      } else if (field.type === "staticText") {
        initial[field.id] = field.value;
      } else {
        initial[field.id] = "";
      }
    }
    return initial;
  });

  // Track per-field color overrides
  const [fieldColors, setFieldColors] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of template.fields) {
      if (existingData[`${field.id}_color`]) {
        initial[field.id] = existingData[`${field.id}_color`];
      } else {
        initial[field.id] = "#000000";
      }
    }
    return initial;
  });

  // Track image preview URLs
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of template.fields) {
      if (field.type === "image" && existingData[field.id]) {
        initial[field.id] = existingData[field.id];
      }
    }
    return initial;
  });

  const { handleSubmit, formState: { isSubmitting } } = useForm();

  function updateFieldValue(fieldId: string, value: any) {
    setFieldData((prev) => ({ ...prev, [fieldId]: value }));
  }

  function updateFieldColor(fieldId: string, color: string) {
    setFieldColors((prev) => ({ ...prev, [fieldId]: color }));
  }

  const handleImageUpload = useCallback((fieldId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImagePreviews((prev) => ({ ...prev, [fieldId]: dataUrl }));
      setFieldData((prev) => ({ ...prev, [fieldId]: dataUrl }));
    };
    reader.readAsDataURL(file);
  }, []);

  function onSubmit() {
    // Build the data record
    const data: Record<string, any> = {};
    for (const field of template.fields) {
      data[field.id] = fieldData[field.id] ?? "";
      if (field.type === "textField" || field.type === "date") {
        data[`${field.id}_color`] = fieldColors[field.id] ?? "#000000";
      }
    }

    if (isEditing) {
      // Update existing prepared stamp
      updateStamp(template.id, { data });
      toast({ title: "Stamp updated", description: "Prepared stamp values have been updated." });
      onStampPrepared(template.id);
    } else {
      // Create new prepared stamp
      const templateId = template.id;
      const newStamp: NewPreparedStamp = {
        type: "prepared",
        name: `${template.name} (prepared)`,
        templateId,
        width: template.width,
        height: template.height,
        fields: template.fields,
        backgroundColor: template.backgroundColor,
        data,
      };
      const id = addStamp(newStamp);
      toast({ title: "Stamp prepared", description: `"${newStamp.name}" is ready to use.` });
      onStampPrepared(id);
    }
  }

  function renderField(field: DynamicField) {
    switch (field.type) {
      case "staticText":
        return (
          <div key={field.id} className="space-y-1.5">
            <Label className="text-muted-foreground">{field.label}</Label>
            <p className="rounded-md border border-input bg-muted/50 px-3 py-2 text-sm">
              {field.value}
            </p>
          </div>
        );

      case "textField":
        return (
          <div key={field.id} className="space-y-1.5">
            <Label htmlFor={`pf-${field.id}`}>{field.label}</Label>
            <div className="flex gap-2">
              <Input
                id={`pf-${field.id}`}
                placeholder={field.placeholder ?? ""}
                value={fieldData[field.id] ?? ""}
                onChange={(e) => updateFieldValue(field.id, e.target.value)}
                className="flex-1"
              />
              <input
                type="color"
                value={fieldColors[field.id] ?? "#000000"}
                onChange={(e) => updateFieldColor(field.id, e.target.value)}
                className="h-10 w-10 cursor-pointer rounded-md border border-input"
                title="Text color"
              />
            </div>
          </div>
        );

      case "date":
        return (
          <div key={field.id} className="space-y-1.5">
            <Label htmlFor={`pf-${field.id}`}>{field.label}</Label>
            <div className="flex gap-2">
              <Input
                id={`pf-${field.id}`}
                type="date"
                value={fieldData[field.id] ?? ""}
                onChange={(e) => updateFieldValue(field.id, e.target.value)}
                className="flex-1"
              />
              <input
                type="color"
                value={fieldColors[field.id] ?? "#000000"}
                onChange={(e) => updateFieldColor(field.id, e.target.value)}
                className="h-10 w-10 cursor-pointer rounded-md border border-input"
                title="Text color"
              />
            </div>
          </div>
        );

      case "image":
        return (
          <div key={field.id} className="space-y-1.5">
            <Label htmlFor={`pf-${field.id}`}>{field.label}</Label>
            {imagePreviews[field.id] ? (
              <div className="rounded-md border border-input p-2">
                <img
                  src={imagePreviews[field.id]}
                  alt={field.label}
                  className="mx-auto max-h-24 object-contain"
                />
              </div>
            ) : (
              <label
                htmlFor={`pf-${field.id}`}
                className="flex h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-input bg-muted/50 text-muted-foreground transition-colors hover:border-primary hover:bg-muted"
              >
                <ImagePlus className="h-5 w-5" />
                <span className="text-xs">Upload image</span>
              </label>
            )}
            <input
              id={`pf-${field.id}`}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              className={imagePreviews[field.id] ? "text-sm" : "sr-only"}
              onChange={(e) => handleImageUpload(field.id, e)}
            />
          </div>
        );
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Fill in the values for <span className="font-medium text-foreground">{template.name}</span>
      </p>

      {template.fields.map((field) => renderField(field))}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isEditing ? "Update Stamp" : "Prepare Stamp"}
      </Button>
    </form>
  );
}
