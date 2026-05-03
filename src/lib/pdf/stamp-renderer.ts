"use client";

import type {
  Stamp,
  TextStamp,
  ImageStamp,
  DynamicStamp,
  PreparedStamp,
  AppliedStamp,
  DynamicField,
  BlendMode,
} from "@/types/stampify";
import { EXPORT_PIXEL_RATIO } from "@/config/constants";

// ---------------------------------------------------------------------------
// Image cache
// ---------------------------------------------------------------------------

const imageCache = new Map<string, HTMLImageElement>();

/**
 * Load an image from `src` with crossOrigin="anonymous".
 * Resolved images are cached so repeated calls for the same URL are free.
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) return Promise.resolve(cached);

  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () =>
      reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

/**
 * Trace a rounded-rectangle path on `ctx`.
 * Does NOT fill or stroke — the caller decides what to do with the path.
 */
export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Stamp dimensions
// ---------------------------------------------------------------------------

/**
 * Return the "base" width/height for a stamp.
 *
 * If an `applied` stamp is provided its `baseWidth` / `baseHeight` take
 * precedence, falling back to the stamp definition itself.
 */
export function getStampBaseDimensions(
  stamp: Stamp,
  applied?: AppliedStamp,
): { width: number; height: number } {
  if (applied) {
    return {
      width: applied.baseWidth ?? stamp.width,
      height: applied.baseHeight ?? stamp.height,
    };
  }
  return { width: stamp.width, height: stamp.height };
}

// ---------------------------------------------------------------------------
// Blend-mode mapping
// ---------------------------------------------------------------------------

function toCompositeOperation(
  blend: BlendMode,
): GlobalCompositeOperation {
  switch (blend) {
    case "overlay":
      return "overlay";
    case "normal":
    default:
      return "source-over";
  }
}

// ---------------------------------------------------------------------------
// Type-specific draw functions
// ---------------------------------------------------------------------------

/**
 * Draw a **text** stamp at the origin (0, 0) — the caller has already
 * translated / rotated / scaled the context.
 */
function drawTextStamp(
  ctx: CanvasRenderingContext2D,
  stamp: TextStamp,
  width: number,
  height: number,
): void {
  const { template, text, fontColor, lineColor, fontSize, opacity, blendMode } =
    stamp;

  // Opacity & blend mode
  ctx.globalAlpha = opacity / 100;
  ctx.globalCompositeOperation = toCompositeOperation(blendMode);

  const padding = 6;
  const borderWidth = 2;

  // --- borders -----------------------------------------------------------
  if (
    template === "text_with_border" ||
    template === "text_with_date_and_border"
  ) {
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(
      borderWidth / 2,
      borderWidth / 2,
      width - borderWidth,
      height - borderWidth,
    );
  } else if (template === "text_with_rounded_border") {
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = borderWidth;
    drawRoundedRect(
      ctx,
      borderWidth / 2,
      borderWidth / 2,
      width - borderWidth,
      height - borderWidth,
      8,
    );
    ctx.stroke();
  }

  // --- text --------------------------------------------------------------
  ctx.fillStyle = fontColor;
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const lines = text.split("\n");

  if (template === "text_with_date_and_border") {
    // Reserve bottom area for the date line
    const dateText = new Date().toLocaleDateString();
    const dateFontSize = Math.max(10, fontSize * 0.6);

    const mainAreaHeight = height - dateFontSize - padding * 2;
    const lineHeight = fontSize * 1.2;
    const totalTextHeight = lines.length * lineHeight;
    const startY = (mainAreaHeight - totalTextHeight) / 2 + lineHeight / 2;

    lines.forEach((line, i) => {
      ctx.fillText(line, width / 2, startY + i * lineHeight, width - padding * 2);
    });

    // Date line
    ctx.font = `${dateFontSize}px sans-serif`;
    ctx.fillText(dateText, width / 2, height - padding - dateFontSize / 2, width - padding * 2);
  } else {
    const lineHeight = fontSize * 1.2;
    const totalTextHeight = lines.length * lineHeight;
    const startY = (height - totalTextHeight) / 2 + lineHeight / 2;

    lines.forEach((line, i) => {
      ctx.fillText(line, width / 2, startY + i * lineHeight, width - padding * 2);
    });
  }

  // Reset composite operation so later draws are unaffected
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

/**
 * Draw an **image** stamp at the origin.
 */
async function drawImageStamp(
  ctx: CanvasRenderingContext2D,
  stamp: ImageStamp,
  width: number,
  height: number,
): Promise<void> {
  try {
    const img = await loadImage(stamp.storageUrl);

    // Scale the image to fit within the stamp bounds while preserving its
    // aspect ratio.
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const boxAspect = width / height;

    let drawW: number;
    let drawH: number;

    if (imgAspect > boxAspect) {
      drawW = width;
      drawH = width / imgAspect;
    } else {
      drawH = height;
      drawW = height * imgAspect;
    }

    const offsetX = (width - drawW) / 2;
    const offsetY = (height - drawH) / 2;

    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
  } catch {
    // Draw a fallback placeholder on error
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#999";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Image unavailable", width / 2, height / 2);
  }
}

/**
 * Draw a **dynamic** or **prepared** stamp at the origin.
 *
 * Fields are drawn bottom-to-top so the first field in the array appears at
 * the bottom of the stamp (matching the visual stacking convention used
 * elsewhere in Stampify).
 */
async function drawDynamicStamp(
  ctx: CanvasRenderingContext2D,
  stamp: DynamicStamp | PreparedStamp,
  applied: AppliedStamp,
  width: number,
  height: number,
): Promise<void> {
  const { fields, backgroundColor } = stamp;
  const data: Record<string, any> = applied.data ?? (stamp.type === "prepared" ? stamp.data : {});
  const borderWidth = 2;
  const padding = 8;
  const fieldFontSize = 13;
  const lineHeight = fieldFontSize * 1.5;

  // --- background --------------------------------------------------------
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  // --- border ------------------------------------------------------------
  ctx.strokeStyle = "#333";
  ctx.lineWidth = borderWidth;
  ctx.strokeRect(
    borderWidth / 2,
    borderWidth / 2,
    width - borderWidth,
    height - borderWidth,
  );

  // --- fields (drawn bottom-to-top) -------------------------------------
  const fieldCount = fields.length;
  if (fieldCount === 0) return;

  // We compute a top-down Y starting position so the block of fields is
  // vertically centred, but we iterate bottom-to-top for layering.
  const totalFieldsHeight = fieldCount * lineHeight;
  const startY =
    (height - totalFieldsHeight) / 2 + lineHeight / 2;

  ctx.fillStyle = "#000";
  ctx.font = `${fieldFontSize}px sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  // Iterate from the last field to the first (bottom-to-top visual order).
  for (let i = fieldCount - 1; i >= 0; i--) {
    const field: DynamicField = fields[i];
    const y = startY + i * lineHeight;
    const maxWidth = width - padding * 2;

    switch (field.type) {
      case "staticText": {
        ctx.fillStyle = "#000";
        ctx.fillText(field.value, padding, y, maxWidth);
        break;
      }
      case "textField": {
        const value = data[field.id] ?? "";
        const display = value
          ? `${field.label}: ${value}`
          : `${field.label}: —`;
        ctx.fillStyle = "#000";
        ctx.fillText(display, padding, y, maxWidth);
        break;
      }
      case "date": {
        const raw = data[field.id];
        let formatted = "—";
        if (raw) {
          try {
            const d = new Date(raw);
            formatted = d.toLocaleDateString();
          } catch {
            formatted = String(raw);
          }
        }
        ctx.fillStyle = "#000";
        ctx.fillText(`${field.label}: ${formatted}`, padding, y, maxWidth);
        break;
      }
      case "image": {
        const imgUrl: string | undefined = data[field.id] ?? field.storageUrl;
        const imgSize = lineHeight - 4;
        if (imgUrl) {
          try {
            const img = await loadImage(imgUrl);
            ctx.drawImage(img, padding, y - imgSize / 2, imgSize, imgSize);
          } catch {
            drawImagePlaceholder(ctx, padding, y - imgSize / 2, imgSize, imgSize);
          }
        } else {
          drawImagePlaceholder(ctx, padding, y - imgSize / 2, imgSize, imgSize);
        }
        // Draw label to the right of the image
        ctx.fillStyle = "#000";
        ctx.fillText(
          field.label,
          padding + imgSize + 4,
          y,
          maxWidth - imgSize - 4,
        );
        break;
      }
    }
  }
}

/** Small grey rectangle with an "x" as a placeholder for missing images. */
function drawImagePlaceholder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillStyle = "#ddd";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#aaa";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  // Small "x"
  ctx.beginPath();
  ctx.moveTo(x + 2, y + 2);
  ctx.lineTo(x + w - 2, y + h - 2);
  ctx.moveTo(x + w - 2, y + 2);
  ctx.lineTo(x + 2, y + h - 2);
  ctx.strokeStyle = "#999";
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

/**
 * Render a single stamp onto `ctx`.
 *
 * The function applies translation, rotation, and scaling derived from the
 * `applied` stamp before delegating to the type-specific drawing routine.
 * Canvas state is saved/restored so the caller's context is untouched.
 */
export async function drawStampOnCanvas(
  ctx: CanvasRenderingContext2D,
  stamp: Stamp,
  applied: AppliedStamp,
  zoom: number,
): Promise<void> {
  ctx.save();

  // Move to the stamp's position on the page
  ctx.translate(applied.x * zoom, applied.y * zoom);

  // Derive scale from how much the applied size differs from the base size
  const base = getStampBaseDimensions(stamp, applied);
  const scaleX = (applied.width / base.width) * zoom;
  const scaleY = (applied.height / base.height) * zoom;

  // Rotate around the stamp centre
  ctx.translate((applied.width * zoom) / 2, (applied.height * zoom) / 2);
  ctx.rotate((applied.rotation * Math.PI) / 180);
  ctx.translate(-(applied.width * zoom) / 2, -(applied.height * zoom) / 2);

  ctx.scale(scaleX, scaleY);

  // The individual draw functions work in "base" coordinates (0,0 → base.width × base.height)
  switch (stamp.type) {
    case "text":
      drawTextStamp(ctx, stamp, base.width, base.height);
      break;
    case "image":
      await drawImageStamp(ctx, stamp, base.width, base.height);
      break;
    case "dynamic":
    case "prepared":
      await drawDynamicStamp(ctx, stamp, applied, base.width, base.height);
      break;
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Offscreen render to Data URL
// ---------------------------------------------------------------------------

export interface RenderStampOptions {
  /** Device-pixel ratio multiplier. Defaults to EXPORT_PIXEL_RATIO. */
  pixelRatio?: number;
  /**
   * `"base"` — use the stamp's base dimensions.
   * `"applied"` — use the applied stamp's width/height.
   * Defaults to `"applied"`.
   */
  mode?: "applied" | "base";
}

/**
 * Render a stamp to an offscreen canvas and return a PNG data-URL.
 *
 * High-DPI is handled by creating a canvas `pixelRatio`× larger than the
 * logical dimensions and scaling the context accordingly.
 */
export async function renderStampToDataURL(
  stamp: Stamp,
  applied: AppliedStamp,
  options?: RenderStampOptions,
): Promise<string> {
  const pixelRatio = options?.pixelRatio ?? EXPORT_PIXEL_RATIO;
  const mode = options?.mode ?? "applied";

  const base = getStampBaseDimensions(stamp, applied);
  const logicalWidth = mode === "base" ? base.width : applied.width;
  const logicalHeight = mode === "base" ? base.height : applied.height;

  const canvas = document.createElement("canvas");
  canvas.width = logicalWidth * pixelRatio;
  canvas.height = logicalHeight * pixelRatio;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to obtain 2D context from offscreen canvas");

  // Scale for high-DPI
  ctx.scale(pixelRatio, pixelRatio);

  // Build a synthetic applied stamp positioned at the origin with no
  // rotation so we render the stamp "flat".
  const flatApplied: AppliedStamp = {
    ...applied,
    x: 0,
    y: 0,
    rotation: 0,
    width: logicalWidth,
    height: logicalHeight,
  };

  await drawStampOnCanvas(ctx, stamp, flatApplied, 1);

  return canvas.toDataURL("image/png");
}

// ---------------------------------------------------------------------------
// Preview helper
// ---------------------------------------------------------------------------

/**
 * Create a synthetic `AppliedStamp` suitable for preview rendering.
 *
 * All positional properties default to zero; dimensions are taken from the
 * stamp definition. Pass `overrides` to customise individual fields.
 */
export function createPreviewAppliedStamp(
  stamp: Stamp,
  overrides?: Partial<AppliedStamp>,
): AppliedStamp {
  return {
    id: `preview-${stamp.id}`,
    stampId: stamp.id,
    page: 1,
    x: 0,
    y: 0,
    width: stamp.width,
    height: stamp.height,
    baseWidth: stamp.width,
    baseHeight: stamp.height,
    rotation: 0,
    data: {},
    ...overrides,
  };
}
