import type { NewPreparedStamp, PreparedStamp, Stamp } from "@/types/stampify";

export const CUSTOM_STAMP_TEMPLATE_FAMILY = "custom-block-template";

export type CustomStampBlockType =
  | "logo"
  | "text"
  | "labelValue"
  | "date"
  | "signature"
  | "spacer";

export type CustomStampLogoKind =
  | "intertek-mark"
  | "intertek-wordmark"
  | "uploaded";

export type CustomStampAlign = "left" | "center" | "right";
export type CustomStampFontWeight = "normal" | "bold";

interface CustomStampBaseBlock {
  id: string;
  type: CustomStampBlockType;
  marginTop?: number;
  marginBottom?: number;
}

export interface CustomStampLogoBlock extends CustomStampBaseBlock {
  type: "logo";
  logoKind: CustomStampLogoKind;
  imageDataUrl?: string;
  width: number;
  height: number;
  align: CustomStampAlign;
}

export interface CustomStampTextBlock extends CustomStampBaseBlock {
  type: "text";
  text: string;
  color: string;
  fontSize: number;
  fontWeight: CustomStampFontWeight;
  italic: boolean;
  align: CustomStampAlign;
  lineHeight?: number;
}

export interface CustomStampLabelValueBlock extends CustomStampBaseBlock {
  type: "labelValue";
  label: string;
  value: string;
  color: string;
  labelColor: string;
  fontSize: number;
  labelWeight: CustomStampFontWeight;
  valueWeight: CustomStampFontWeight;
  italic: boolean;
  labelWidth: number;
}

export interface CustomStampDateBlock extends CustomStampBaseBlock {
  type: "date";
  label: string;
  value: string;
  color: string;
  fontSize: number;
  fontWeight: CustomStampFontWeight;
  italic: boolean;
  align: CustomStampAlign;
}

export interface CustomStampSignatureBlock extends CustomStampBaseBlock {
  type: "signature";
  signerName: string;
  imageDataUrl?: string;
  width: number;
  height: number;
  color: string;
  fontSize: number;
  align: CustomStampAlign;
}

export interface CustomStampSpacerBlock extends CustomStampBaseBlock {
  type: "spacer";
  height: number;
}

export type CustomStampBlock =
  | CustomStampLogoBlock
  | CustomStampTextBlock
  | CustomStampLabelValueBlock
  | CustomStampDateBlock
  | CustomStampSignatureBlock
  | CustomStampSpacerBlock;

export interface CustomStampTemplateData extends Record<string, unknown> {
  __templateFamily: typeof CUSTOM_STAMP_TEMPLATE_FAMILY;
  state: string;
  purpose: string;
  width: number;
  height: number;
  backgroundColor: string;
  padding: number;
  blocks: CustomStampBlock[];
}

export interface CustomStampTemplateInput {
  state: string;
  purpose: string;
  width: number;
  height: number;
  backgroundColor: string;
  padding: number;
  blocks: CustomStampBlock[];
}

export interface CustomStampPreset {
  id: string;
  name: string;
  state: string;
  purpose: string;
  width: number;
  height: number;
  padding: number;
  backgroundColor: string;
  blocks: CustomStampBlock[];
}

const RED = "#ff0000";
const YELLOW = "#f5b400";
const BLACK = "#111111";

export const CUSTOM_STAMP_PRESETS: CustomStampPreset[] = [
  {
    id: "blank-intertek-stack",
    name: "Blank Intertek Stack",
    state: "General",
    purpose: "Custom Approval Stamp",
    width: 340,
    height: 220,
    padding: 18,
    backgroundColor: "transparent",
    blocks: [
      {
        id: "logo",
        type: "logo",
        logoKind: "intertek-mark",
        width: 78,
        height: 78,
        align: "left",
        marginBottom: 8,
      },
      {
        id: "company",
        type: "text",
        text: "Intertek-ATI (Architectural Testing)",
        color: YELLOW,
        fontSize: 16,
        fontWeight: "normal",
        italic: false,
        align: "left",
      },
      {
        id: "approval",
        type: "text",
        text: "Approved",
        color: RED,
        fontSize: 18,
        fontWeight: "bold",
        italic: true,
        align: "left",
      },
      {
        id: "date",
        type: "date",
        label: "Approval Date:",
        value: "2026-05-17",
        color: BLACK,
        fontSize: 16,
        fontWeight: "normal",
        italic: false,
        align: "left",
      },
    ],
  },
  {
    id: "florida-simple",
    name: "Florida Compliance Simple",
    state: "Florida",
    purpose: "Manufactured Building Approval",
    width: 390,
    height: 250,
    padding: 18,
    backgroundColor: "transparent",
    blocks: [
      {
        id: "logo",
        type: "logo",
        logoKind: "intertek-mark",
        width: 78,
        height: 78,
        align: "left",
        marginBottom: 8,
      },
      {
        id: "company",
        type: "text",
        text: "Intertek-ATI (Architectural Testing)",
        color: YELLOW,
        fontSize: 16,
        fontWeight: "normal",
        italic: false,
        align: "left",
      },
      {
        id: "compliance",
        type: "text",
        text:
          "This document meets or exceeds the Requirements of the State of Florida Manufactured Building Rules & Regulations",
        color: RED,
        fontSize: 15,
        fontWeight: "bold",
        italic: true,
        align: "left",
        lineHeight: 1.25,
      },
      {
        id: "date",
        type: "date",
        label: "Approval Date:",
        value: "2026-05-17",
        color: BLACK,
        fontSize: 16,
        fontWeight: "normal",
        italic: false,
        align: "left",
      },
    ],
  },
  {
    id: "florida-detailed",
    name: "Florida Compliance Detailed",
    state: "Florida",
    purpose: "Detailed Building Approval",
    width: 390,
    height: 440,
    padding: 18,
    backgroundColor: "transparent",
    blocks: [
      {
        id: "logo",
        type: "logo",
        logoKind: "intertek-mark",
        width: 72,
        height: 72,
        align: "left",
        marginBottom: 8,
      },
      {
        id: "company",
        type: "text",
        text: "Intertek-ATI (Architectural Testing)",
        color: YELLOW,
        fontSize: 14,
        fontWeight: "normal",
        italic: true,
        align: "left",
      },
      {
        id: "code",
        type: "text",
        text:
          "This document meets or exceeds the Requirements of the State of Florida Manufactured Building Rules & Regulations\n2023 Florida Building Codes",
        color: RED,
        fontSize: 14,
        fontWeight: "bold",
        italic: true,
        align: "left",
        lineHeight: 1.25,
      },
      {
        id: "construction",
        type: "labelValue",
        label: "Const.Type:",
        value: "II-B",
        color: BLACK,
        labelColor: BLACK,
        fontSize: 12,
        labelWeight: "normal",
        valueWeight: "normal",
        italic: false,
        labelWidth: 95,
      },
      {
        id: "occupancy",
        type: "labelValue",
        label: "Occupancy:",
        value: "B",
        color: BLACK,
        labelColor: BLACK,
        fontSize: 12,
        labelWeight: "normal",
        valueWeight: "normal",
        italic: false,
        labelWidth: 95,
      },
      {
        id: "wind",
        type: "labelValue",
        label: "Wind Velocity:",
        value: "142 mph",
        color: BLACK,
        labelColor: BLACK,
        fontSize: 12,
        labelWeight: "normal",
        valueWeight: "normal",
        italic: false,
        labelWidth: 95,
      },
      {
        id: "plan",
        type: "labelValue",
        label: "Plan #:",
        value: "R-22380",
        color: BLACK,
        labelColor: BLACK,
        fontSize: 12,
        labelWeight: "normal",
        valueWeight: "normal",
        italic: false,
        labelWidth: 95,
      },
      {
        id: "approval-date",
        type: "date",
        label: "Approval Date:",
        value: "2026-05-17",
        color: BLACK,
        fontSize: 13,
        fontWeight: "bold",
        italic: false,
        align: "left",
      },
      {
        id: "signature",
        type: "signature",
        signerName: "William Tegeler",
        width: 150,
        height: 40,
        color: BLACK,
        fontSize: 14,
        align: "left",
      },
    ],
  },
  {
    id: "plans-examiner",
    name: "Plans Examiner Field List",
    state: "General",
    purpose: "Plans Examiner Approval",
    width: 390,
    height: 330,
    padding: 18,
    backgroundColor: "transparent",
    blocks: [
      {
        id: "logo",
        type: "logo",
        logoKind: "intertek-mark",
        width: 74,
        height: 74,
        align: "left",
        marginBottom: 8,
      },
      {
        id: "address",
        type: "text",
        text: "Intertek\n1748 33rd Street\nOrlando, FL 32839",
        color: YELLOW,
        fontSize: 14,
        fontWeight: "bold",
        italic: false,
        align: "left",
        lineHeight: 1.25,
      },
      {
        id: "examiner",
        type: "labelValue",
        label: "Plans Examiner:",
        value: "William Tegeler",
        color: BLACK,
        labelColor: BLACK,
        fontSize: 14,
        labelWeight: "bold",
        valueWeight: "normal",
        italic: false,
        labelWidth: 135,
      },
      {
        id: "construction",
        type: "labelValue",
        label: "Construction Type:",
        value: "II-B",
        color: BLACK,
        labelColor: BLACK,
        fontSize: 14,
        labelWeight: "bold",
        valueWeight: "normal",
        italic: false,
        labelWidth: 135,
      },
      {
        id: "occupancy",
        type: "labelValue",
        label: "Occupancy:",
        value: "B",
        color: BLACK,
        labelColor: BLACK,
        fontSize: 14,
        labelWeight: "bold",
        valueWeight: "normal",
        italic: false,
        labelWidth: 135,
      },
      {
        id: "approval-date",
        type: "date",
        label: "Approval Date:",
        value: "2026-05-17",
        color: BLACK,
        fontSize: 14,
        fontWeight: "bold",
        italic: false,
        align: "left",
      },
    ],
  },
];

export function createCustomStampTemplateData(
  data: CustomStampTemplateInput,
): CustomStampTemplateData {
  return {
    __templateFamily: CUSTOM_STAMP_TEMPLATE_FAMILY,
    ...data,
    state: data.state.trim() || "General",
    purpose: data.purpose.trim() || "Custom Stamp",
    backgroundColor: data.backgroundColor || "transparent",
    padding: data.padding ?? 18,
  };
}

export function createCustomPreparedStamp(
  data: CustomStampTemplateData,
): NewPreparedStamp {
  return {
    type: "prepared",
    name: `${data.state} - ${data.purpose}`,
    templateId: CUSTOM_STAMP_TEMPLATE_FAMILY,
    width: data.width,
    height: data.height,
    fields: [],
    backgroundColor: data.backgroundColor,
    data,
  };
}

export function isCustomBlockStamp(
  stamp: Stamp,
): stamp is PreparedStamp & { data: CustomStampTemplateData } {
  return (
    stamp.type === "prepared" &&
    stamp.data?.__templateFamily === CUSTOM_STAMP_TEMPLATE_FAMILY
  );
}

export function resolveCustomStampData(
  stamp: PreparedStamp,
  overrides?: Record<string, unknown>,
): CustomStampTemplateData {
  const raw = {
    ...stamp.data,
    ...(overrides ?? {}),
  } as Partial<CustomStampTemplateData>;

  return createCustomStampTemplateData({
    state: String(raw.state || "General"),
    purpose: String(raw.purpose || stamp.name || "Custom Stamp"),
    width: Number(raw.width || stamp.width || 340),
    height: Number(raw.height || stamp.height || 220),
    backgroundColor: String(raw.backgroundColor || "transparent"),
    padding: Number(raw.padding ?? 18),
    blocks: Array.isArray(raw.blocks) ? raw.blocks : [],
  });
}

export function getCustomStampImageSources(
  stamp: PreparedStamp,
  overrides?: Record<string, unknown>,
): string[] {
  const data = resolveCustomStampData(stamp, overrides);
  return data.blocks.flatMap((block) => {
    if (block.type === "logo" && block.logoKind === "uploaded" && block.imageDataUrl) {
      return [block.imageDataUrl];
    }
    if (block.type === "signature" && block.imageDataUrl) {
      return [block.imageDataUrl];
    }
    return [];
  });
}

export function getCustomStampState(stamp: Stamp): string | null {
  if (!isCustomBlockStamp(stamp)) return null;
  return resolveCustomStampData(stamp).state;
}

function fontString(
  fontSize: number,
  fontWeight: CustomStampFontWeight,
  italic = false,
): string {
  const style = italic ? "italic " : "";
  const weight = fontWeight === "bold" ? "700 " : "";
  return `${style}${weight}${fontSize}px Arial, Helvetica, sans-serif`;
}

function xForAlign(
  align: CustomStampAlign,
  left: number,
  width: number,
  itemWidth: number,
): number {
  if (align === "center") return left + (width - itemWidth) / 2;
  if (align === "right") return left + width - itemWidth;
  return left;
}

function textAlignFor(align: CustomStampAlign): CanvasTextAlign {
  if (align === "center") return "center";
  if (align === "right") return "right";
  return "left";
}

function textXForAlign(align: CustomStampAlign, left: number, width: number): number {
  if (align === "center") return left + width / 2;
  if (align === "right") return left + width;
  return left;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth || !line) {
        line = next;
      } else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const lines = wrapText(ctx, text, maxWidth);
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, y + i * lineHeight, maxWidth);
  }
  return lines.length * lineHeight;
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
  ctx.strokeStyle = BLACK;
  ctx.lineWidth = size * 0.06;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI * 0.14, Math.PI * 1.94);
  ctx.stroke();

  ctx.fillStyle = BLACK;
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

function drawIntertekWordmark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.fillStyle = BLACK;
  ctx.font = `700 ${Math.min(height * 0.55, width * 0.18)}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("intertek", x, y, width);

  ctx.fillStyle = BLACK;
  ctx.font = `${Math.max(8, height * 0.14)}px Arial, Helvetica, sans-serif`;
  ctx.fillText("Total Quality. Assured.", x + width * 0.02, y + height * 0.66, width);

  ctx.fillStyle = "#f5c400";
  ctx.beginPath();
  ctx.arc(x + width * 0.03, y + height * 0.17, height * 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawImageFit(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  boxWidth: number,
  boxHeight: number,
): void {
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  if (!naturalWidth || !naturalHeight) return;

  const scale = Math.min(boxWidth / naturalWidth, boxHeight / naturalHeight);
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;

  ctx.drawImage(
    image,
    x + (boxWidth - width) / 2,
    y + (boxHeight - height) / 2,
    width,
    height,
  );
}

export function drawCustomStampOnCanvas(
  ctx: CanvasRenderingContext2D,
  stamp: PreparedStamp,
  width: number,
  height: number,
  options: {
    data?: Record<string, unknown>;
    imageMap?: Map<string, HTMLImageElement>;
  } = {},
): void {
  const data = resolveCustomStampData(stamp, options.data);
  const scale = Math.min(width / data.width, height / data.height);
  const logicalWidth = width / scale;
  const logicalHeight = height / scale;
  const padding = data.padding;
  const contentLeft = padding;
  const contentWidth = logicalWidth - padding * 2;
  let y = padding;

  ctx.save();
  ctx.scale(scale, scale);

  if (data.backgroundColor && data.backgroundColor !== "transparent") {
    ctx.fillStyle = data.backgroundColor;
    ctx.fillRect(0, 0, logicalWidth, logicalHeight);
  }

  for (const block of data.blocks) {
    y += block.marginTop ?? 0;

    if (block.type === "logo") {
      const x = xForAlign(block.align, contentLeft, contentWidth, block.width);
      if (block.logoKind === "uploaded" && block.imageDataUrl) {
        const image = options.imageMap?.get(block.imageDataUrl);
        if (image) {
          drawImageFit(ctx, image, x, y, block.width, block.height);
        }
      } else if (block.logoKind === "intertek-wordmark") {
        drawIntertekWordmark(ctx, x, y, block.width, block.height);
      } else {
        drawIntertekMark(ctx, x, y, Math.min(block.width, block.height));
      }
      y += block.height;
    } else if (block.type === "text") {
      ctx.fillStyle = block.color;
      ctx.font = fontString(block.fontSize, block.fontWeight, block.italic);
      ctx.textAlign = textAlignFor(block.align);
      ctx.textBaseline = "alphabetic";
      const lineHeight = block.fontSize * (block.lineHeight ?? 1.25);
      y += block.fontSize;
      y += drawWrappedText(
        ctx,
        block.text,
        textXForAlign(block.align, contentLeft, contentWidth),
        y,
        contentWidth,
        lineHeight,
      ) - lineHeight;
    } else if (block.type === "labelValue") {
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      y += block.fontSize;
      ctx.fillStyle = block.labelColor;
      ctx.font = fontString(block.fontSize, block.labelWeight, block.italic);
      ctx.fillText(block.label, contentLeft, y, block.labelWidth);
      ctx.fillStyle = block.color;
      ctx.font = fontString(block.fontSize, block.valueWeight, block.italic);
      ctx.fillText(
        block.value,
        contentLeft + block.labelWidth,
        y,
        contentWidth - block.labelWidth,
      );
    } else if (block.type === "date") {
      ctx.fillStyle = block.color;
      ctx.font = fontString(block.fontSize, block.fontWeight, block.italic);
      ctx.textAlign = textAlignFor(block.align);
      ctx.textBaseline = "alphabetic";
      y += block.fontSize;
      const text = `${block.label} ${block.value}`.trim();
      ctx.fillText(
        text,
        textXForAlign(block.align, contentLeft, contentWidth),
        y,
        contentWidth,
      );
    } else if (block.type === "signature") {
      const x = xForAlign(block.align, contentLeft, contentWidth, block.width);
      if (block.imageDataUrl) {
        const image = options.imageMap?.get(block.imageDataUrl);
        if (image) {
          drawImageFit(ctx, image, x, y, block.width, block.height);
        }
      } else {
        ctx.fillStyle = block.color;
        ctx.font = fontString(block.fontSize, "normal", true);
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(block.signerName, x, y + block.height / 2, block.width);
        ctx.strokeStyle = block.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y + block.height - 4);
        ctx.lineTo(x + block.width, y + block.height - 4);
        ctx.stroke();
      }
      y += block.height;

      if (block.signerName) {
        ctx.fillStyle = block.color;
        ctx.font = fontString(Math.max(10, block.fontSize * 0.8), "bold");
        ctx.textAlign = textAlignFor(block.align);
        ctx.textBaseline = "alphabetic";
        y += Math.max(10, block.fontSize * 0.8);
        ctx.fillText(
          block.signerName,
          textXForAlign(block.align, contentLeft, contentWidth),
          y,
          contentWidth,
        );
      }
    } else if (block.type === "spacer") {
      y += block.height;
    }

    y += block.marginBottom ?? 4;
    if (y > logicalHeight) break;
  }

  ctx.restore();
}
