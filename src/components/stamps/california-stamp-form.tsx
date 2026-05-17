"use client";

import {
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { CalendarDays, ImagePlus, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { StampPreview } from "@/components/stamps/stamp-preview";
import { useAppliedStampActions } from "@/hooks/use-applied-stamp-actions";
import { useStampActions } from "@/hooks/use-stamp-actions";
import { toast } from "@/hooks/use-toast";
import { useFilesStore, selectActiveFile } from "@/stores/files";
import {
  calculateCaliforniaExpirationDate,
  CALIFORNIA_PLACEMENT_SIZE_LABELS,
  CALIFORNIA_STAMP_TEMPLATES,
  createCaliforniaPreparedStamp,
  createCaliforniaStampData,
  formatDateInput,
  getCaliforniaDefaultAppliedSize,
  getCaliforniaTemplate,
  type CaliforniaStampData,
  type CaliforniaPlacementSizePreset,
  type CaliforniaStampTemplateId,
} from "@/lib/stamps/california";

interface CaliforniaStampFormProps {
  onComplete: () => void;
}

const DEFAULT_PAGE_WIDTH = 612;
const DEFAULT_PAGE_HEIGHT = 792;
const DEFAULT_MARGIN = 24;
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const MAX_LOGO_SIDE = 512;

function defaultData(templateId: CaliforniaStampTemplateId): CaliforniaStampData {
  return createCaliforniaStampData(templateId, {
    approvalDate: formatDateInput(),
  });
}

function resizeLogoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Logo file could not be read."));
    reader.onload = (event) => {
      const source = event.target?.result;
      if (typeof source !== "string") {
        reject(new Error("Logo file could not be read."));
        return;
      }

      const image = new Image();
      image.onerror = () => reject(new Error("Logo image could not be loaded."));
      image.onload = () => {
        const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
        const scale = largestSide > MAX_LOGO_SIDE ? MAX_LOGO_SIDE / largestSide : 1;
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Logo image could not be processed."));
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

export function CaliforniaStampForm({ onComplete }: CaliforniaStampFormProps) {
  const activeFile = useFilesStore(selectActiveFile);
  const activeFileId = useFilesStore((s) => s.activeFileId);
  const { createStamp } = useStampActions();
  const { addStamp: addAppliedStamp } = useAppliedStampActions();

  const [templateId, setTemplateId] =
    useState<CaliforniaStampTemplateId>("ca-cm-fbh");
  const [sizePreset, setSizePreset] =
    useState<CaliforniaPlacementSizePreset>("default");
  const [data, setData] = useState<CaliforniaStampData>(() =>
    defaultData("ca-cm-fbh"),
  );
  const [submitting, setSubmitting] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  const template = useMemo(() => getCaliforniaTemplate(templateId), [templateId]);
  const previewStamp = useMemo(
    () => ({
      ...createCaliforniaPreparedStamp(templateId, data),
      id: "preview-california",
    }),
    [templateId, data],
  );

  function updateField(field: keyof CaliforniaStampData, value: string) {
    setData((current) => ({ ...current, [field]: value }));
  }

  function handleTemplateChange(nextTemplateId: CaliforniaStampTemplateId) {
    setTemplateId(nextTemplateId);
    setData((current) => ({
      ...defaultData(nextTemplateId),
      logoDataUrl: current.logoDataUrl,
    }));
  }

  function handleApprovalDateChange(approvalDate: string) {
    setData((current) => ({
      ...current,
      approvalDate,
      expirationDate: calculateCaliforniaExpirationDate(templateId, approvalDate),
    }));
  }

  async function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Logo not supported",
        description: "Upload a PNG, JPG, or WEBP image.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > MAX_LOGO_BYTES) {
      toast({
        title: "Logo is too large",
        description: "Upload an image smaller than 5 MB.",
        variant: "destructive",
      });
      return;
    }

    setLogoUploading(true);
    try {
      const logoDataUrl = await resizeLogoFile(file);
      updateField("logoDataUrl", logoDataUrl);
    } catch (error) {
      console.error("[CaliforniaStampForm] Failed to load logo:", error);
      toast({
        title: "Logo failed",
        description: "The logo image could not be loaded.",
        variant: "destructive",
      });
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const stampData = createCaliforniaStampData(templateId, data);
      const newStamp = createCaliforniaPreparedStamp(templateId, stampData);
      const stampId = await createStamp(newStamp);

      if (!stampId) return;

      const canApply = activeFile && activeFileId && activeFile.pageCount > 0;

      if (canApply) {
        const appliedSize = getCaliforniaDefaultAppliedSize(
          templateId,
          DEFAULT_PAGE_WIDTH,
          sizePreset,
        );
        const x = Math.max(
          DEFAULT_MARGIN,
          DEFAULT_PAGE_WIDTH - appliedSize.width - DEFAULT_MARGIN,
        );
        const y = Math.max(
          DEFAULT_MARGIN,
          DEFAULT_PAGE_HEIGHT - appliedSize.height - DEFAULT_MARGIN,
        );

        for (let page = 1; page <= activeFile.pageCount; page++) {
          addAppliedStamp(activeFileId, page, {
            stampId,
            x,
            y,
            width: appliedSize.width,
            height: appliedSize.height,
            baseWidth: newStamp.width,
            baseHeight: newStamp.height,
            rotation: 0,
            data: { ...stampData },
          });
        }

        toast({
          title: "California stamp applied",
          description: `"${template.name}" was applied to all ${activeFile.pageCount} page(s).`,
        });
      } else {
        toast({
          title: "California stamp saved",
          description: "Open a PDF file to apply it to all pages.",
        });
      }

      onComplete();
    } catch (error) {
      console.error("[CaliforniaStampForm] Failed to create stamp:", error);
      toast({
        title: "Stamp failed",
        description: "The California stamp could not be created.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-3 md:sticky md:top-0 md:self-start">
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
              className="mx-auto h-60 w-full object-contain"
            />
          </div>

          <div className="rounded-md border bg-card px-3 py-2 text-xs text-muted-foreground shadow-sm">
            {activeFile
              ? `Will apply to ${activeFile.pageCount} page${activeFile.pageCount === 1 ? "" : "s"} in ${activeFile.name}.`
              : "Open a PDF first to apply the prepared stamp to every page."}
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <section className="min-w-0 space-y-3 rounded-md border bg-card p-4 shadow-sm">
            <p className="text-sm font-semibold">Template</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_0.55fr]">
              <div className="space-y-1.5">
                <Label htmlFor="ca-template" className="text-xs">
                  California stamp
                </Label>
                <Select
                  id="ca-template"
                  className="h-9"
                  value={templateId}
                  onChange={(e) =>
                    handleTemplateChange(
                      e.target.value as CaliforniaStampTemplateId,
                    )
                  }
                >
                  {CALIFORNIA_STAMP_TEMPLATES.map((stampTemplate) => (
                    <option key={stampTemplate.id} value={stampTemplate.id}>
                      {stampTemplate.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ca-size-preset" className="text-xs">
                  Starting size
                </Label>
                <Select
                  id="ca-size-preset"
                  className="h-9"
                  value={sizePreset}
                  onChange={(e) =>
                    setSizePreset(
                      e.target.value as CaliforniaPlacementSizePreset,
                    )
                  }
                >
                  {Object.entries(CALIFORNIA_PLACEMENT_SIZE_LABELS).map(
                    ([preset, label]) => (
                      <option key={preset} value={preset}>
                        {label}
                      </option>
                    ),
                  )}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ca-approval-date" className="text-xs">
                  Approval date
                </Label>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="ca-approval-date"
                    type="date"
                    className="h-9 pl-9"
                    value={data.approvalDate}
                    onChange={(e) => handleApprovalDateChange(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ca-expiration-date" className="text-xs">
                  Expiration date ({template.expirationMonths} mo)
                </Label>
                <Input
                  id="ca-expiration-date"
                  type="date"
                  className="h-9"
                  value={data.expirationDate}
                  onChange={(e) => updateField("expirationDate", e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="min-w-0 space-y-3 rounded-md border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Logo</p>
              {data.logoDataUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => updateField("logoDataUrl", "")}
                >
                  <X className="h-3.5 w-3.5" />
                  Remove
                </Button>
              )}
            </div>

            <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3">
              <div
                className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border"
                style={{
                  backgroundColor: "#f8fafc",
                  backgroundImage:
                    "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)",
                  backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
                  backgroundSize: "12px 12px",
                }}
              >
                {data.logoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={data.logoDataUrl}
                    alt="Uploaded logo"
                    className="h-full w-full object-contain p-1"
                  />
                ) : (
                  <ImagePlus className="h-6 w-6 text-muted-foreground" />
                )}
              </div>

              <div className="min-w-0 space-y-2">
                <Label
                  htmlFor="ca-logo-file"
                  className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  {logoUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                  {data.logoDataUrl ? "Replace logo" : "Upload logo"}
                </Label>
                <input
                  id="ca-logo-file"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  className="sr-only"
                  disabled={logoUploading}
                  onChange={handleLogoUpload}
                />
                {data.logoDataUrl && (
                  <p className="truncate text-xs text-muted-foreground">
                    Custom logo active
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="min-w-0 space-y-3 rounded-md border bg-card p-4 shadow-sm">
            <p className="text-sm font-semibold">Approval Details</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_0.9fr]">
              <div className="space-y-1.5">
                <Label htmlFor="ca-identifier-label" className="text-xs">
                  DAA label
                </Label>
                <Input
                  id="ca-identifier-label"
                  className="h-9"
                  value={data.identifierLabel}
                  onChange={(e) => updateField("identifierLabel", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ca-identifier-value" className="text-xs">
                  DAA number
                </Label>
                <Input
                  id="ca-identifier-value"
                  className="h-9"
                  value={data.identifierValue}
                  onChange={(e) => updateField("identifierValue", e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_0.9fr]">
              <div className="space-y-1.5">
                <Label htmlFor="ca-plan-label" className="text-xs">
                  Plan label
                </Label>
                <Input
                  id="ca-plan-label"
                  className="h-9"
                  value={data.planLabel}
                  onChange={(e) => updateField("planLabel", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ca-plan-approval" className="text-xs">
                  Plan approval
                </Label>
                <Input
                  id="ca-plan-approval"
                  className="h-9"
                  value={data.planApproval}
                  onChange={(e) => updateField("planApproval", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ca-note" className="text-xs">
                Red note
              </Label>
              <Input
                id="ca-note"
                className="h-9"
                value={data.note}
                onChange={(e) => updateField("note", e.target.value)}
              />
            </div>
          </section>

          <section className="min-w-0 space-y-3 rounded-md border bg-card p-4 shadow-sm">
            <p className="text-sm font-semibold">Address</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ca-address-1" className="text-xs">
                  Address line 1
                </Label>
                <Input
                  id="ca-address-1"
                  className="h-9"
                  value={data.addressLine1}
                  onChange={(e) => updateField("addressLine1", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ca-address-2" className="text-xs">
                  Address line 2
                </Label>
                <Input
                  id="ca-address-2"
                  className="h-9"
                  value={data.addressLine2}
                  onChange={(e) => updateField("addressLine2", e.target.value)}
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      <Button
        type="submit"
        className="h-10 w-full"
        disabled={submitting || logoUploading}
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparing...
          </>
        ) : activeFile ? (
          "Save and Apply to All Pages"
        ) : (
          "Save California Stamp"
        )}
      </Button>
    </form>
  );
}
