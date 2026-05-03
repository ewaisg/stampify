"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";

import { useStampsStore } from "@/stores/stamps";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  DynamicField,
  DynamicFieldType,
  DynamicStamp,
  NewDynamicStamp,
} from "@/types/stampify";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const fieldSchema = z.object({
  type: z.enum(["staticText", "textField", "date", "image"]) as z.ZodType<DynamicFieldType>,
  label: z.string().min(1, "Label is required"),
  // Type-specific optional configs
  fontSize: z.number().min(8).max(144).optional(),
  fontWeight: z.enum(["normal", "bold"]).optional(),
  fontColor: z.string().optional(),
  placeholder: z.string().optional(),
  defaultValue: z.string().optional(),
  maxHeight: z.number().min(10).max(500).optional(),
});

const dynamicStampSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Max 100 characters"),
  width: z.number().min(50).max(500),
  height: z.number().min(50).max(500),
  backgroundColor: z.string(),
  fields: z.array(fieldSchema).min(1, "At least one field is required"),
});

type FieldFormValues = z.infer<typeof fieldSchema>;
type DynamicStampFormValues = z.infer<typeof dynamicStampSchema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DynamicStampFormProps {
  onStampCreated?: () => void;
  onTemplateDesigned?: (template: Omit<DynamicStamp, "id">) => void;
}

export function DynamicStampForm({ onStampCreated, onTemplateDesigned }: DynamicStampFormProps) {
  const addStamp = useStampsStore((s) => s.addStamp);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DynamicStampFormValues>({
    resolver: zodResolver(dynamicStampSchema),
    defaultValues: {
      name: "",
      width: 300,
      height: 200,
      backgroundColor: "#ffffff",
      fields: [{ type: "staticText", label: "Title", fontSize: 24, fontWeight: "bold", fontColor: "#000000" }],
    },
  });

  const { fields, append, remove, swap } = useFieldArray({
    control,
    name: "fields",
  });

  const watchedFields = watch("fields");

  function processFields(raw: FieldFormValues[]): DynamicField[] {
    return raw.map((f, idx) => {
      const id = crypto.randomUUID();
      const base = { id, label: f.label };

      switch (f.type) {
        case "staticText":
          return {
            ...base,
            type: "staticText" as const,
            value: f.defaultValue ?? f.label,
          };
        case "textField":
          return {
            ...base,
            type: "textField" as const,
            placeholder: f.placeholder ?? "",
          };
        case "date":
          return {
            ...base,
            type: "date" as const,
            format: "yyyy-MM-dd",
          };
        case "image":
          return {
            ...base,
            type: "image" as const,
            storageUrl: undefined,
          };
      }
    });
  }

  function onSubmit(values: DynamicStampFormValues) {
    const processedFields = processFields(values.fields);

    const template: Omit<DynamicStamp, "id"> = {
      type: "dynamic",
      name: values.name,
      width: values.width,
      height: values.height,
      backgroundColor: values.backgroundColor,
      fields: processedFields,
    };

    if (onTemplateDesigned) {
      onTemplateDesigned(template);
      toast({ title: "Template designed", description: `"${values.name}" template is ready.` });
    } else {
      addStamp(template as NewDynamicStamp);
      toast({ title: "Dynamic stamp created", description: `"${values.name}" has been added to your library.` });
    }

    onStampCreated?.();
  }

  function handleAddField() {
    append({
      type: "textField",
      label: "",
      fontSize: 16,
      fontWeight: "normal",
      fontColor: "#000000",
      placeholder: "",
      defaultValue: "",
    });
  }

  function handleMoveUp(index: number) {
    if (index > 0) swap(index, index - 1);
  }

  function handleMoveDown(index: number) {
    if (index < fields.length - 1) swap(index, index + 1);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="ds-name">Template Name</Label>
        <Input id="ds-name" placeholder="My dynamic stamp" {...register("name")} />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      {/* Dimensions */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="ds-width">Width</Label>
          <Input
            id="ds-width"
            type="number"
            min={50}
            max={500}
            {...register("width", { valueAsNumber: true })}
          />
          {errors.width && <p className="text-xs text-destructive">{errors.width.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ds-height">Height</Label>
          <Input
            id="ds-height"
            type="number"
            min={50}
            max={500}
            {...register("height", { valueAsNumber: true })}
          />
          {errors.height && <p className="text-xs text-destructive">{errors.height.message}</p>}
        </div>
      </div>

      {/* Background Color */}
      <div className="space-y-1.5">
        <Label htmlFor="ds-bg">Background Color</Label>
        <input
          id="ds-bg"
          type="color"
          className="h-10 w-full cursor-pointer rounded-md border border-input"
          {...register("backgroundColor")}
        />
      </div>

      {/* Fields array */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Fields</Label>
          <Button type="button" variant="outline" size="sm" onClick={handleAddField}>
            <Plus className="mr-1 h-3 w-3" />
            Add Field
          </Button>
        </div>

        {errors.fields?.root && (
          <p className="text-xs text-destructive">{errors.fields.root.message}</p>
        )}

        {fields.map((field, index) => {
          const currentType = watchedFields?.[index]?.type;

          return (
            <div
              key={field.id}
              className="space-y-2 rounded-md border border-input p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Field {index + 1}
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === 0}
                    onClick={() => handleMoveUp(index)}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={index === fields.length - 1}
                    onClick={() => handleMoveDown(index)}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    disabled={fields.length <= 1}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Type select */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                    {...register(`fields.${index}.type`)}
                  >
                    <option value="staticText">Static Text</option>
                    <option value="textField">Text Field</option>
                    <option value="date">Date</option>
                    <option value="image">Image</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Label</Label>
                  <Input
                    className="h-9"
                    placeholder="Field label"
                    {...register(`fields.${index}.label`)}
                  />
                  {errors.fields?.[index]?.label && (
                    <p className="text-xs text-destructive">{errors.fields[index].label?.message}</p>
                  )}
                </div>
              </div>

              {/* Type-specific configs */}
              <div className="grid grid-cols-3 gap-2">
                {(currentType === "staticText" || currentType === "textField") && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Font Size</Label>
                      <Input
                        type="number"
                        min={8}
                        max={144}
                        className="h-9"
                        {...register(`fields.${index}.fontSize`, { valueAsNumber: true })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Font Weight</Label>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                        {...register(`fields.${index}.fontWeight`)}
                      >
                        <option value="normal">Normal</option>
                        <option value="bold">Bold</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Font Color</Label>
                      <input
                        type="color"
                        className="h-9 w-full cursor-pointer rounded-md border border-input"
                        {...register(`fields.${index}.fontColor`)}
                      />
                    </div>
                  </>
                )}

                {currentType === "staticText" && (
                  <div className="col-span-3 space-y-1">
                    <Label className="text-xs">Default Value</Label>
                    <Input
                      className="h-9"
                      placeholder="Static text content"
                      {...register(`fields.${index}.defaultValue`)}
                    />
                  </div>
                )}

                {currentType === "textField" && (
                  <div className="col-span-3 space-y-1">
                    <Label className="text-xs">Placeholder</Label>
                    <Input
                      className="h-9"
                      placeholder="Enter placeholder text"
                      {...register(`fields.${index}.placeholder`)}
                    />
                  </div>
                )}

                {currentType === "image" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Max Height</Label>
                    <Input
                      type="number"
                      min={10}
                      max={500}
                      className="h-9"
                      {...register(`fields.${index}.maxHeight`, { valueAsNumber: true })}
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {onTemplateDesigned ? "Design Template" : "Create Dynamic Stamp"}
      </Button>
    </form>
  );
}
