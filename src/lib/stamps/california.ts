import { addMonths, format, subDays } from "date-fns";
import type { NewPreparedStamp, PreparedStamp, Stamp } from "@/types/stampify";

export const CALIFORNIA_TEMPLATE_FAMILY = "california";

const DEFAULT_PLACED_WIDTH = 240;
const MIN_PLACED_WIDTH = 160;
const MAX_PAGE_WIDTH_RATIO = 0.48;

export type CaliforniaStampTemplateId =
  | "ca-cm-fbh"
  | "ca-commercial-wo-foundation"
  | "ca-fbh-wo-foundation";

export type CaliforniaPlacementSizePreset = "compact" | "default" | "large";

const PLACED_WIDTH_BY_PRESET: Record<CaliforniaPlacementSizePreset, number> = {
  compact: 200,
  default: DEFAULT_PLACED_WIDTH,
  large: 280,
};

export const CALIFORNIA_PLACEMENT_SIZE_LABELS: Record<
  CaliforniaPlacementSizePreset,
  string
> = {
  compact: "Compact",
  default: "Default",
  large: "Large",
};

export interface CaliforniaStampTemplate {
  id: CaliforniaStampTemplateId;
  name: string;
  title: string;
  agencyLine: string;
  identifierLabel: string;
  identifierDefault: string;
  planLabel: string;
  planDefault: string;
  noteDefault: string;
  expirationMonths: number;
  width: number;
  height: number;
}

export interface CaliforniaStampData extends Record<string, string> {
  __templateFamily: typeof CALIFORNIA_TEMPLATE_FAMILY;
  templateId: CaliforniaStampTemplateId;
  title: string;
  agencyLine: string;
  identifierLabel: string;
  identifierValue: string;
  planLabel: string;
  planApproval: string;
  approvalDate: string;
  expirationDate: string;
  note: string;
  addressLine1: string;
  addressLine2: string;
  logoDataUrl: string;
}

export const CALIFORNIA_STAMP_TEMPLATES: CaliforniaStampTemplate[] = [
  {
    id: "ca-cm-fbh",
    name: "CA CM and FBH Stamp",
    title: "Approved for Factory Built Housing Only",
    agencyLine: "Approved by: State of California",
    identifierLabel: "Factory Built Housing – DAA",
    identifierDefault: "#DF1507648",
    planLabel: "Plan Approval#",
    planDefault: "R-21346",
    noteDefault: "Without Foundation / Site Work Approval",
    expirationMonths: 36,
    width: 430,
    height: 300,
  },
  {
    id: "ca-commercial-wo-foundation",
    name: "CA Stamp (CM wo Foundation) 15 mo",
    title: "Approved for Commercial",
    agencyLine: "Approved by: State of California",
    identifierLabel: "MH DAA",
    identifierDefault: "#DM1507408",
    planLabel: "Plan Approval:",
    planDefault: "R-21519",
    noteDefault: "Without Foundation / Site Work Approval",
    expirationMonths: 15,
    width: 430,
    height: 300,
  },
  {
    id: "ca-fbh-wo-foundation",
    name: "CA Stamp (FBH wo Foundation) 3 years",
    title: "Approved for Factory Built Housing Only",
    agencyLine: "Approved by: State of California",
    identifierLabel: "Factory Built Housing – DAA",
    identifierDefault: "#DF1507648",
    planLabel: "Plan Approval:",
    planDefault: "#R-21408 R3",
    noteDefault: "Without Foundation / Site Work Approval",
    expirationMonths: 36,
    width: 430,
    height: 300,
  },
];

export function getCaliforniaTemplate(
  templateId: CaliforniaStampTemplateId,
): CaliforniaStampTemplate {
  const template = CALIFORNIA_STAMP_TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    throw new Error(`Unknown California stamp template: ${templateId}`);
  }
  return template;
}

export function getCaliforniaDefaultAppliedSize(
  templateId: CaliforniaStampTemplateId,
  pageWidth = 612,
  sizePreset: CaliforniaPlacementSizePreset = "default",
): { width: number; height: number } {
  const template = getCaliforniaTemplate(templateId);
  const targetWidth = PLACED_WIDTH_BY_PRESET[sizePreset];
  const width = Math.min(
    template.width,
    Math.max(
      MIN_PLACED_WIDTH,
      Math.min(targetWidth, pageWidth * MAX_PAGE_WIDTH_RATIO),
    ),
  );

  return {
    width,
    height: (width / template.width) * template.height,
  };
}

export function formatDateInput(date = new Date()): string {
  return format(date, "yyyy-MM-dd");
}

export function calculateCaliforniaExpirationDate(
  templateId: CaliforniaStampTemplateId,
  approvalDate: string,
): string {
  if (!approvalDate) return "";

  const template = getCaliforniaTemplate(templateId);
  const parsed = new Date(`${approvalDate}T00:00:00`);

  if (Number.isNaN(parsed.getTime())) return "";

  return format(subDays(addMonths(parsed, template.expirationMonths), 1), "yyyy-MM-dd");
}

export function createCaliforniaStampData(
  templateId: CaliforniaStampTemplateId,
  overrides?: Partial<CaliforniaStampData>,
): CaliforniaStampData {
  const template = getCaliforniaTemplate(templateId);
  const approvalDate = overrides?.approvalDate || formatDateInput();

  return {
    __templateFamily: CALIFORNIA_TEMPLATE_FAMILY,
    templateId,
    title: overrides?.title || template.title,
    agencyLine: overrides?.agencyLine || template.agencyLine,
    identifierLabel: overrides?.identifierLabel || template.identifierLabel,
    identifierValue: overrides?.identifierValue || template.identifierDefault,
    planLabel: overrides?.planLabel || template.planLabel,
    planApproval: overrides?.planApproval || template.planDefault,
    approvalDate,
    expirationDate:
      overrides?.expirationDate ||
      calculateCaliforniaExpirationDate(templateId, approvalDate),
    note: overrides?.note ?? template.noteDefault,
    addressLine1: overrides?.addressLine1 || "1748 33rd Street",
    addressLine2: overrides?.addressLine2 || "Orlando, FL 32839",
    logoDataUrl: overrides?.logoDataUrl || "",
  };
}

export function createCaliforniaPreparedStamp(
  templateId: CaliforniaStampTemplateId,
  data: CaliforniaStampData,
): NewPreparedStamp {
  const template = getCaliforniaTemplate(templateId);

  return {
    type: "prepared",
    name: template.name,
    templateId,
    width: template.width,
    height: template.height,
    fields: [],
    backgroundColor: "transparent",
    data,
  };
}

export function isCaliforniaStamp(stamp: Stamp): boolean {
  return (
    stamp.type === "prepared" &&
    stamp.data?.__templateFamily === CALIFORNIA_TEMPLATE_FAMILY
  );
}

export function resolveCaliforniaStampData(
  stamp: PreparedStamp,
  overrides?: Record<string, unknown>,
): CaliforniaStampData {
  const templateId =
    ((overrides?.templateId ?? stamp.data.templateId) as
      | CaliforniaStampTemplateId
      | undefined) ||
    "ca-cm-fbh";
  return createCaliforniaStampData(templateId, {
    ...(stamp.data as Partial<CaliforniaStampData>),
    ...(overrides as Partial<CaliforniaStampData> | undefined),
  });
}

export function getCaliforniaLogoSource(
  stamp: PreparedStamp,
  overrides?: Record<string, unknown>,
): string {
  return resolveCaliforniaStampData(stamp, overrides).logoDataUrl;
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
): void {
  ctx.fillText(text, x, y, maxWidth);
}

function drawLabelValue(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  labelWidth: number,
  maxWidth: number,
): void {
  ctx.fillStyle = "#111111";
  ctx.font = "16px Arial, Helvetica, sans-serif";
  drawText(ctx, label, x, y, labelWidth);
  drawText(ctx, value, x + labelWidth, y, maxWidth - labelWidth);
}

function drawIntertekMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
): void {
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size * 0.42;

  ctx.save();
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = size * 0.055;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.14, Math.PI * 1.94);
  ctx.stroke();

  ctx.fillStyle = "#111111";
  ctx.font = `700 ${size * 0.58}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("in", cx - size * 0.03, cy + size * 0.02);

  ctx.fillStyle = "#f5c400";
  ctx.beginPath();
  ctx.arc(x + size * 0.32, y + size * 0.22, size * 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + size * 0.79, y + size * 0.74, size * 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawLogoImage(
  ctx: CanvasRenderingContext2D,
  logoImage: HTMLImageElement,
  x: number,
  y: number,
  size: number,
): boolean {
  const naturalWidth = logoImage.naturalWidth || logoImage.width;
  const naturalHeight = logoImage.naturalHeight || logoImage.height;
  if (!naturalWidth || !naturalHeight) return false;

  const imageAspect = naturalWidth / naturalHeight;
  let drawWidth = size;
  let drawHeight = size;

  if (imageAspect > 1) {
    drawHeight = size / imageAspect;
  } else {
    drawWidth = size * imageAspect;
  }

  ctx.drawImage(
    logoImage,
    x + (size - drawWidth) / 2,
    y + (size - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  return true;
}

interface DrawCaliforniaStampOptions {
  data?: Record<string, unknown>;
  logoImage?: HTMLImageElement | null;
}

export function drawCaliforniaStampOnCanvas(
  ctx: CanvasRenderingContext2D,
  stamp: PreparedStamp,
  width: number,
  height: number,
  options: DrawCaliforniaStampOptions = {},
): void {
  const data = resolveCaliforniaStampData(stamp, options.data);
  const scale = Math.min(width / 430, height / 300);
  const sx = (value: number) => value * scale;
  const sy = (value: number) => value * scale;

  ctx.save();

  const left = sx(28);
  let y = sy(38);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "#ff0000";
  ctx.font = `italic 700 ${sx(17)}px Arial, Helvetica, sans-serif`;
  drawText(ctx, data.title, left, y, width - left * 2);

  y += sy(23);
  ctx.fillStyle = "#111111";
  ctx.font = `${sx(16)}px Arial, Helvetica, sans-serif`;
  drawText(ctx, data.agencyLine, left, y, width - left * 2);

  y += sy(23);
  drawText(
    ctx,
    `${data.identifierLabel} ${data.identifierValue}`.trim(),
    left,
    y,
    width - left * 2,
  );

  y += sy(23);
  drawText(ctx, "Intertek (Intertek-ATI)", left, y, width - left * 2);

  y += sy(23);
  drawLabelValue(
    ctx,
    data.planLabel,
    data.planApproval,
    left,
    y,
    sx(144),
    width - left * 2,
  );

  y += sy(23);
  drawLabelValue(
    ctx,
    "Approval Date:",
    data.approvalDate,
    left,
    y,
    sx(144),
    width - left * 2,
  );

  y += sy(23);
  drawLabelValue(
    ctx,
    "Expiration Date:",
    data.expirationDate,
    left,
    y,
    sx(144),
    width - left * 2,
  );

  if (data.note.trim()) {
    y += sy(22);
    ctx.fillStyle = "#ff0000";
    ctx.font = `italic 700 ${sx(16)}px Arial, Helvetica, sans-serif`;
    drawText(ctx, data.note, left, y, width - left * 2);
  }

  const logoTop = sy(206);
  const logoSize = sy(88);
  if (
    !options.logoImage ||
    !drawLogoImage(ctx, options.logoImage, left, logoTop, logoSize)
  ) {
    drawIntertekMark(ctx, left, logoTop, logoSize);
  }

  ctx.fillStyle = "#f5b400";
  ctx.font = `700 ${sx(15)}px Arial, Helvetica, sans-serif`;
  drawText(ctx, data.addressLine1, sx(156), sy(244), width - sx(180));
  drawText(ctx, data.addressLine2, sx(156), sy(267), width - sx(180));

  ctx.restore();
}
