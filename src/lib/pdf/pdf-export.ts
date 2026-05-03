"use client";

import { PDFDocument } from "pdf-lib";
import { saveAs } from "file-saver";
import JSZip from "jszip";

import { renderStampToDataURL } from "./stamp-renderer";
import type { AppliedStamp, Stamp } from "@/types/stampify";
import { EXPORT_PIXEL_RATIO } from "@/config";

// ---------------------------------------------------------------------------
// stampPdf — Embed applied stamps into a single PDF and return the bytes
// ---------------------------------------------------------------------------

export async function stampPdf(
  fileBytes: ArrayBuffer,
  appliedStampsForFile: Map<number, AppliedStamp[]>,
  stamps: Stamp[],
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(fileBytes);
  const pages = pdfDoc.getPages();

  // Cache stamp images so identical stamps are only embedded once.
  // Key: `${stampId}:${width}x${height}:${rotation}:${JSON.stringify(data)}`
  const imageCache = new Map<string, Awaited<ReturnType<typeof pdfDoc.embedPng>>>();

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const pageNumber = pageIndex + 1;
    const stampsOnPage = appliedStampsForFile.get(pageNumber);
    if (!stampsOnPage || stampsOnPage.length === 0) continue;

    const page = pages[pageIndex];
    const { height: pageHeight } = page.getSize();

    for (const applied of stampsOnPage) {
      const stampDef = stamps.find((s) => s.id === applied.stampId);
      if (!stampDef) continue;

      // Build a cache key from properties that affect the rendered image
      const cacheKey = [
        applied.stampId,
        `${applied.width}x${applied.height}`,
        String(applied.rotation),
        JSON.stringify(applied.data ?? {}),
      ].join(":");

      let pdfImage = imageCache.get(cacheKey);

      if (!pdfImage) {
        // Render stamp to a data URL (PNG), then embed into the PDF
        const dataUrl = await renderStampToDataURL(stampDef, applied, {
          pixelRatio: EXPORT_PIXEL_RATIO,
        });

        // Convert data URL to Uint8Array
        const base64 = dataUrl.split(",")[1];
        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        pdfImage = await pdfDoc.embedPng(bytes);
        imageCache.set(cacheKey, pdfImage);
      }

      // pdf-lib uses a bottom-left origin; canvas uses top-left.
      // Convert: pdf_y = pageHeight - canvas_y - stamp_height
      const pdfY = pageHeight - applied.y - applied.height;

      page.drawImage(pdfImage, {
        x: applied.x,
        y: pdfY,
        width: applied.width,
        height: applied.height,
        rotate: undefined, // rotation is baked into the rendered PNG
      });
    }
  }

  return pdfDoc.save();
}

// ---------------------------------------------------------------------------
// downloadStampedPdfs — Stamp & download one or many PDFs
// ---------------------------------------------------------------------------

export async function downloadStampedPdfs(
  files: { name: string; bytes: ArrayBuffer }[],
  allApplied: Map<string, Map<number, AppliedStamp[]>>,
  stamps: Stamp[],
): Promise<void> {
  if (files.length === 0) return;

  if (files.length === 1) {
    const file = files[0];
    const appliedMap = allApplied.get(file.name) ?? new Map();
    const stamped = await stampPdf(file.bytes, appliedMap, stamps);
    const blob = new Blob([stamped.buffer as ArrayBuffer], { type: "application/pdf" });
    saveAs(blob, `stamped_${file.name}`);
    return;
  }

  // Multiple files — bundle into a ZIP
  const zip = new JSZip();

  for (const file of files) {
    const appliedMap = allApplied.get(file.name) ?? new Map();
    const stamped = await stampPdf(file.bytes, appliedMap, stamps);
    zip.file(`stamped_${file.name}`, stamped);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  saveAs(zipBlob, "stamped_pdfs.zip");
}
