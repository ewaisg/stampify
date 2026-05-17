"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  CopyPlus,
  ZoomIn,
  ZoomOut,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/ui";
import { useAppliedStampsStore, selectStampsForPage } from "@/stores/applied-stamps";
import { useStampsStore } from "@/stores/stamps";
import { useFilesStore } from "@/stores/files";
import { useAppliedStampActions } from "@/hooks/use-applied-stamp-actions";
import { MIN_ZOOM, MAX_ZOOM, ZOOM_INCREMENT, MIN_STAMP_SIZE } from "@/config";
import type { AppliedStamp, Stamp } from "@/types/stampify";
import {
  drawCaliforniaStampOnCanvas,
  getCaliforniaLogoSource,
  isCaliforniaStamp,
} from "@/lib/stamps/california";
import {
  drawCustomStampOnCanvas,
  getCustomStampImageSources,
  isCustomBlockStamp,
} from "@/lib/stamps/custom-template";

// ---------------------------------------------------------------------------
// PDF.js worker — served from /public so it is always available, no CDN dep
// ---------------------------------------------------------------------------

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HANDLE_SIZE = 10;
const PDF_RENDER_SCALE = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function drawStampOnCanvas(
  ctx: CanvasRenderingContext2D,
  stamp: Stamp,
  applied: AppliedStamp,
  zoom: number,
  isSelected: boolean,
  californiaLogoImages?: Map<string, HTMLImageElement>,
) {
  const x = applied.x * zoom;
  const y = applied.y * zoom;
  const w = applied.width * zoom;
  const h = applied.height * zoom;
  const baseWidth = applied.baseWidth || stamp.width;
  const baseHeight = applied.baseHeight || stamp.height;
  const scale = Math.min(w / baseWidth, h / baseHeight);
  const renderedWidth = baseWidth * scale;
  const renderedHeight = baseHeight * scale;

  ctx.save();

  if (applied.rotation) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.translate(cx, cy);
    ctx.rotate((applied.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  ctx.translate(
    x + (w - renderedWidth) / 2,
    y + (h - renderedHeight) / 2,
  );
  ctx.scale(scale, scale);

  if (stamp.type === "prepared" && isCaliforniaStamp(stamp)) {
    const logoSource = getCaliforniaLogoSource(stamp, applied.data);
    const logoImage = logoSource
      ? californiaLogoImages?.get(logoSource)
      : null;

    drawCaliforniaStampOnCanvas(ctx, stamp, baseWidth, baseHeight, {
      data: applied.data,
      logoImage,
    });
  } else if (stamp.type === "prepared" && isCustomBlockStamp(stamp)) {
    drawCustomStampOnCanvas(ctx, stamp, baseWidth, baseHeight, {
      data: applied.data,
      imageMap: californiaLogoImages,
    });
  } else if (stamp.type === "text") {
    ctx.globalAlpha = stamp.opacity / 100;

    if (
      stamp.template === "text_with_border" ||
      stamp.template === "text_with_date_and_border"
    ) {
      ctx.strokeStyle = stamp.lineColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, baseWidth, baseHeight);
    } else if (stamp.template === "text_with_rounded_border") {
      ctx.strokeStyle = stamp.lineColor;
      ctx.lineWidth = 2;
      const r = 6;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(baseWidth - r, 0);
      ctx.quadraticCurveTo(baseWidth, 0, baseWidth, r);
      ctx.lineTo(baseWidth, baseHeight - r);
      ctx.quadraticCurveTo(baseWidth, baseHeight, baseWidth - r, baseHeight);
      ctx.lineTo(r, baseHeight);
      ctx.quadraticCurveTo(0, baseHeight, 0, baseHeight - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.stroke();
    }

    ctx.fillStyle = stamp.fontColor;
    ctx.font = `bold ${stamp.fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(stamp.text, baseWidth / 2, baseHeight / 2, baseWidth - 8);
    ctx.globalAlpha = 1;
  } else if (stamp.type === "dynamic" || stamp.type === "prepared") {
    ctx.fillStyle = stamp.backgroundColor || "#f0f0f0";
    ctx.globalAlpha = 0.9;
    ctx.fillRect(0, 0, baseWidth, baseHeight);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, baseWidth, baseHeight);

    const data = applied.data ?? {};
    const fields = stamp.fields;
    const lineHeight = Math.min(baseHeight / Math.max(fields.length, 1), 20);
    ctx.fillStyle = "#333";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    fields.forEach((field, i) => {
      let displayText = field.label + ": ";
      displayText += field.type === "staticText" ? field.value : (data[field.id] ?? "");
      ctx.fillText(displayText, 4, 4 + i * lineHeight, baseWidth - 8);
    });
  } else if (stamp.type === "image") {
    ctx.fillStyle = "#e0e0e0";
    ctx.fillRect(0, 0, baseWidth, baseHeight);
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, baseWidth, baseHeight);
    ctx.fillStyle = "#999";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("[Image]", baseWidth / 2, baseHeight / 2);
  }

  ctx.restore();

  if (isSelected) {
    ctx.save();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
    ctx.setLineDash([]);

    ctx.fillStyle = "#2563eb";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    for (const [hx, hy] of [
      [x - HANDLE_SIZE / 2, y - HANDLE_SIZE / 2],
      [x + w - HANDLE_SIZE / 2, y - HANDLE_SIZE / 2],
      [x - HANDLE_SIZE / 2, y + h - HANDLE_SIZE / 2],
      [x + w - HANDLE_SIZE / 2, y + h - HANDLE_SIZE / 2],
    ]) {
      ctx.fillRect(hx, hy, HANDLE_SIZE, HANDLE_SIZE);
      ctx.strokeRect(hx, hy, HANDLE_SIZE, HANDLE_SIZE);
    }
    ctx.restore();
  }
}

function hitTestHandle(px: number, py: number, applied: AppliedStamp, zoom: number): number {
  const x = applied.x * zoom;
  const y = applied.y * zoom;
  const w = applied.width * zoom;
  const h = applied.height * zoom;
  const hs = HANDLE_SIZE + 4;

  const corners = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]];
  for (let i = 0; i < corners.length; i++) {
    const [cx, cy] = corners[i];
    if (px >= cx - hs / 2 && px <= cx + hs / 2 && py >= cy - hs / 2 && py <= cy + hs / 2) {
      return i;
    }
  }
  return -1;
}

function hitTestStamp(px: number, py: number, applied: AppliedStamp, zoom: number): boolean {
  return (
    px >= applied.x * zoom &&
    px <= (applied.x + applied.width) * zoom &&
    py >= applied.y * zoom &&
    py <= (applied.y + applied.height) * zoom
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function cursorForHandle(handleIdx: number): string {
  return handleIdx === 0 || handleIdx === 3 ? "nwse-resize" : "nesw-resize";
}

function getAppliedAspectRatio(applied: AppliedStamp): number {
  const width = applied.baseWidth || applied.width;
  const height = applied.baseHeight || applied.height;
  return width > 0 && height > 0 ? width / height : 1;
}

function resizeWithAspectRatio(
  origin: { x: number; y: number; width: number; height: number },
  handleIdx: number,
  dx: number,
  dy: number,
  aspectRatio: number,
  pageSize: { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  const right = origin.x + origin.width;
  const bottom = origin.y + origin.height;
  const ratioHeight = origin.width / aspectRatio;

  const proposedWidth =
    handleIdx === 0 || handleIdx === 2
      ? origin.width - dx
      : origin.width + dx;
  const proposedHeight =
    handleIdx === 0 || handleIdx === 1
      ? origin.height - dy
      : origin.height + dy;

  const widthScale = proposedWidth / origin.width;
  const heightScale = proposedHeight / origin.height;
  let scale =
    Math.abs(widthScale - 1) > Math.abs(heightScale - 1)
      ? widthScale
      : heightScale;

  const minScale = Math.max(
    MIN_STAMP_SIZE / origin.width,
    MIN_STAMP_SIZE / ratioHeight,
  );

  let maxScale = Number.POSITIVE_INFINITY;
  if (handleIdx === 0) {
    maxScale = Math.min(right / origin.width, bottom / ratioHeight);
  } else if (handleIdx === 1) {
    maxScale = Math.min(
      (pageSize.width - origin.x) / origin.width,
      bottom / ratioHeight,
    );
  } else if (handleIdx === 2) {
    maxScale = Math.min(
      right / origin.width,
      (pageSize.height - origin.y) / ratioHeight,
    );
  } else {
    maxScale = Math.min(
      (pageSize.width - origin.x) / origin.width,
      (pageSize.height - origin.y) / ratioHeight,
    );
  }

  scale = clamp(scale, minScale, maxScale);

  const width = origin.width * scale;
  const height = ratioHeight * scale;

  let x = origin.x;
  let y = origin.y;

  if (handleIdx === 0) {
    x = right - width;
    y = bottom - height;
  } else if (handleIdx === 1) {
    y = bottom - height;
  } else if (handleIdx === 2) {
    x = right - width;
  }

  return { x, y, width, height };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PdfCanvasProps {
  pdfData: ArrayBuffer | null;
  fetching?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PdfCanvas({ pdfData, fetching = false }: PdfCanvasProps) {
  const { currentPage, setCurrentPage, zoom, setZoom, setTotalPages, selectedStampId, setSelectedStampId } = useUIStore();
  const { activeFileId } = useFilesStore();
  const stamps = useStampsStore((s) => s.stamps);
  const appliedStamps = useAppliedStampsStore((s) => s.appliedStamps);

  const {
    addStamp: addAppliedStamp,
    updateStamp: updateAppliedStamp,
    deleteStamp: deleteAppliedStamp,
    duplicateToAll: duplicateToAllPages,
  } = useAppliedStampActions();

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageSize, setPageSize] = useState({ width: 612, height: 792 });
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(-1);
  const [overlayCursor, setOverlayCursor] = useState("default");
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragStampOrigin, setDragStampOrigin] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const stampCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const californiaLogoImagesRef = useRef(new Map<string, HTMLImageElement>());
  const [californiaLogoVersion, setCaliforniaLogoVersion] = useState(0);

  const fileId = activeFileId ?? "";
  const stampsOnPage = useMemo(() => {
    if (!fileId) return [];
    return selectStampsForPage({ appliedStamps }, fileId, currentPage);
  }, [appliedStamps, fileId, currentPage]);

  const selectedApplied = useMemo(
    () => stampsOnPage.find((s) => s.id === selectedStampId) ?? null,
    [stampsOnPage, selectedStampId],
  );

  const selectedStampDefinition = useMemo(
    () => stamps.find((stamp) => stamp.id === selectedApplied?.stampId) ?? null,
    [selectedApplied, stamps],
  );

  const californiaLogoSources = useMemo(() => {
    const sources = new Set<string>();

    for (const applied of stampsOnPage) {
      const stampDef = stamps.find((s) => s.id === applied.stampId);
      if (stampDef?.type === "prepared" && isCaliforniaStamp(stampDef)) {
        const logoSource = getCaliforniaLogoSource(stampDef, applied.data);
        if (logoSource) sources.add(logoSource);
      }
      if (stampDef?.type === "prepared" && isCustomBlockStamp(stampDef)) {
        for (const source of getCustomStampImageSources(stampDef, applied.data)) {
          sources.add(source);
        }
      }
    }

    return [...sources];
  }, [stampsOnPage, stamps]);

  useEffect(() => {
    setTotalPages(pageCount);
  }, [pageCount, setTotalPages]);

  useEffect(() => {
    let cancelled = false;

    for (const source of californiaLogoSources) {
      if (californiaLogoImagesRef.current.has(source)) continue;

      const image = new Image();
      image.onload = () => {
        if (cancelled) return;
        californiaLogoImagesRef.current.set(source, image);
        setCaliforniaLogoVersion((version) => version + 1);
      };
      image.onerror = () => {
        if (cancelled) return;
        californiaLogoImagesRef.current.set(source, image);
        setCaliforniaLogoVersion((version) => version + 1);
      };
      image.src = source;
    }

    return () => {
      cancelled = true;
    };
  }, [californiaLogoSources]);

  // -----------------------------------------------------------------------
  // Load PDF document
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!pdfData) {
      React.startTransition(() => {
        setPdfDoc(null);
        setPageCount(0);
        setError(null);
      });
      return;
    }

    let cancelled = false;
    React.startTransition(() => {
      setPdfLoading(true);
      setError(null);
      setPdfDoc(null);
    });

    const loadTask = pdfjsLib.getDocument({ data: pdfData.slice(0) });

    loadTask.promise
      .then((doc) => {
        if (cancelled) return;
        setPdfDoc(doc);
        setPageCount(doc.numPages);
        setCurrentPage(1);
        setPdfLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[PdfCanvas] Failed to load PDF:", err);
        setError("Failed to load PDF. The file may be corrupted.");
        setPdfLoading(false);
      });

    return () => {
      cancelled = true;
      loadTask.destroy();
    };
  }, [pdfData, setCurrentPage]);

  // -----------------------------------------------------------------------
  // Render PDF page — canvas is always mounted so ref is always valid
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!pdfDoc || !pdfCanvasRef.current) return;
    if (currentPage < 1 || currentPage > pdfDoc.numPages) return;

    let renderTask: ReturnType<ReturnType<PDFDocumentProxy["getPage"]> extends Promise<infer P> ? P extends { render: (...a: never[]) => infer R } ? () => R : never : never> | null = null;
    let cancelled = false;

    pdfDoc.getPage(currentPage).then((page) => {
      if (cancelled || !pdfCanvasRef.current) return;

      const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
      setPageSize({
        width: viewport.width / PDF_RENDER_SCALE,
        height: viewport.height / PDF_RENDER_SCALE,
      });

      const canvas = pdfCanvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${(viewport.width / PDF_RENDER_SCALE) * zoom}px`;
      canvas.style.height = `${(viewport.height / PDF_RENDER_SCALE) * zoom}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx || cancelled) return;

      renderTask = page.render({ canvasContext: ctx, viewport });
      renderTask.promise.catch((err: unknown) => {
        if (!cancelled) console.error("[PdfCanvas] Render error:", err);
      });
    });

    return () => {
      cancelled = true;
      renderTask?.cancel?.();
    };
  }, [pdfDoc, currentPage, zoom, pdfData]);

  // -----------------------------------------------------------------------
  // Stamp overlay
  // -----------------------------------------------------------------------

  const renderStampOverlay = useCallback(() => {
    const canvas = stampCanvasRef.current;
    if (!canvas) return;
    void californiaLogoVersion;

    const displayWidth = pageSize.width * zoom;
    const displayHeight = pageSize.height * zoom;

    canvas.width = displayWidth * window.devicePixelRatio;
    canvas.height = displayHeight * window.devicePixelRatio;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.clearRect(0, 0, displayWidth, displayHeight);

    for (const applied of stampsOnPage) {
      const stampDef = stamps.find((s) => s.id === applied.stampId);
      if (!stampDef) continue;
      drawStampOnCanvas(
        ctx,
        stampDef,
        applied,
        zoom,
        applied.id === selectedStampId,
        californiaLogoImagesRef.current,
      );
    }
  }, [
    californiaLogoVersion,
    stampsOnPage,
    stamps,
    zoom,
    selectedStampId,
    pageSize,
  ]);

  useEffect(() => {
    renderStampOverlay();
  }, [renderStampOverlay]);

  // -----------------------------------------------------------------------
  // Mouse handlers
  // -----------------------------------------------------------------------

  const getCanvasCoords = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = stampCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!fileId) return;
      e.preventDefault();
      const { x, y } = getCanvasCoords(e);

      if (selectedApplied) {
        const handleIdx = hitTestHandle(x, y, selectedApplied, zoom);
        if (handleIdx >= 0) {
          e.currentTarget.setPointerCapture(e.pointerId);
          setResizing(handleIdx);
          setOverlayCursor(cursorForHandle(handleIdx));
          setDragStart({ x, y });
          setDragStampOrigin({ x: selectedApplied.x, y: selectedApplied.y, width: selectedApplied.width, height: selectedApplied.height });
          return;
        }
      }

      for (let i = stampsOnPage.length - 1; i >= 0; i--) {
        const applied = stampsOnPage[i];
        if (hitTestStamp(x, y, applied, zoom)) {
          e.currentTarget.setPointerCapture(e.pointerId);
          setSelectedStampId(applied.id);
          setDragging(true);
          setOverlayCursor("grabbing");
          setDragStart({ x, y });
          setDragStampOrigin({ x: applied.x, y: applied.y, width: applied.width, height: applied.height });
          return;
        }
      }

      setSelectedStampId(null);
      setOverlayCursor("default");
    },
    [fileId, getCanvasCoords, selectedApplied, setSelectedStampId, stampsOnPage, zoom],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const { x, y } = getCanvasCoords(e);

      if (!dragging && resizing < 0) {
        if (selectedApplied) {
          const handleIdx = hitTestHandle(x, y, selectedApplied, zoom);
          if (handleIdx >= 0) {
            setOverlayCursor(cursorForHandle(handleIdx));
            return;
          }
        }

        const isOverStamp = stampsOnPage.some((applied) =>
          hitTestStamp(x, y, applied, zoom),
        );
        setOverlayCursor(isOverStamp ? "move" : "default");
        return;
      }

      if (!fileId || !dragStart || !dragStampOrigin || !selectedStampId) return;

      const dx = (x - dragStart.x) / zoom;
      const dy = (y - dragStart.y) / zoom;
      const applied = stampsOnPage.find((s) => s.id === selectedStampId);
      if (!applied) return;

      if (dragging) {
        updateAppliedStamp(fileId, currentPage, {
          ...applied,
          x: clamp(dragStampOrigin.x + dx, 0, pageSize.width - applied.width),
          y: clamp(dragStampOrigin.y + dy, 0, pageSize.height - applied.height),
        });
      } else if (resizing >= 0) {
        const resized = resizeWithAspectRatio(
          dragStampOrigin,
          resizing,
          dx,
          dy,
          getAppliedAspectRatio(applied),
          pageSize,
        );

        updateAppliedStamp(fileId, currentPage, {
          ...applied,
          x: resized.x,
          y: resized.y,
          width: resized.width,
          height: resized.height,
        });
      }
    },
    [
      currentPage,
      dragStart,
      dragStampOrigin,
      dragging,
      fileId,
      getCanvasCoords,
      pageSize,
      resizing,
      selectedApplied,
      selectedStampId,
      stampsOnPage,
      updateAppliedStamp,
      zoom,
    ],
  );

  const handlePointerEnd = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    setDragging(false);
    setResizing(-1);
    setDragStart(null);
    setDragStampOrigin(null);

    const { x, y } = getCanvasCoords(e);
    const isOverStamp = stampsOnPage.some((applied) =>
      hitTestStamp(x, y, applied, zoom),
    );
    setOverlayCursor(isOverStamp ? "move" : "default");
  }, [getCanvasCoords, stampsOnPage, zoom]);

  const handlePointerLeave = useCallback(() => {
    if (!dragging && resizing < 0) {
      setOverlayCursor("default");
    }
  }, [dragging, resizing]);

  // -----------------------------------------------------------------------
  // Drop zone
  // -----------------------------------------------------------------------

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!fileId) return;

      const stampId =
        e.dataTransfer.getData("application/stampify-stamp-id") ||
        e.dataTransfer.getData("text/plain");
      if (!stampId) return;

      const stampDef = stamps.find((s) => s.id === stampId);
      if (!stampDef) return;

      const canvas = stampCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dropX = (e.clientX - rect.left) / zoom;
      const dropY = (e.clientY - rect.top) / zoom;

      addAppliedStamp(fileId, currentPage, {
        stampId: stampDef.id,
        x: Math.max(0, dropX - stampDef.width / 2),
        y: Math.max(0, dropY - stampDef.height / 2),
        width: stampDef.width,
        height: stampDef.height,
        baseWidth: stampDef.width,
        baseHeight: stampDef.height,
        rotation: stampDef.type === "text" ? stampDef.rotation : 0,
        data: stampDef.type === "prepared" ? stampDef.data : undefined,
      });
    },
    [fileId, stamps, zoom, currentPage, addAppliedStamp],
  );

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const handleDelete = useCallback(() => {
    if (!fileId || !selectedStampId) return;
    deleteAppliedStamp(fileId, currentPage, selectedStampId);
    setSelectedStampId(null);
  }, [fileId, selectedStampId, currentPage, deleteAppliedStamp, setSelectedStampId]);

  const handleDuplicateToAll = useCallback(() => {
    if (!fileId || !selectedApplied || pageCount === 0) return;
    duplicateToAllPages(fileId, selectedApplied, pageCount);
  }, [fileId, selectedApplied, pageCount, duplicateToAllPages]);

  const selectMatchingStampOnPage = useCallback(
    (page: number) => {
      if (!fileId || !selectedApplied) {
        setSelectedStampId(null);
        return;
      }

      const pageStamps = selectStampsForPage({ appliedStamps }, fileId, page);
      const matchingStamp = pageStamps.find(
        (applied) => applied.stampId === selectedApplied.stampId,
      );

      setSelectedStampId(matchingStamp?.id ?? null);
    },
    [appliedStamps, fileId, selectedApplied, setSelectedStampId],
  );

  const handlePrevPage = useCallback(() => {
    if (currentPage <= 1) return;
    const previousPage = currentPage - 1;
    setCurrentPage(previousPage);
    selectMatchingStampOnPage(previousPage);
  }, [currentPage, selectMatchingStampOnPage, setCurrentPage]);

  const handleNextPage = useCallback(() => {
    if (currentPage >= pageCount) return;
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    selectMatchingStampOnPage(nextPage);
  }, [currentPage, pageCount, selectMatchingStampOnPage, setCurrentPage]);

  const handleZoomIn = useCallback(() => setZoom(Math.min(MAX_ZOOM, zoom + ZOOM_INCREMENT)), [zoom, setZoom]);
  const handleZoomOut = useCallback(() => setZoom(Math.max(MIN_ZOOM, zoom - ZOOM_INCREMENT)), [zoom, setZoom]);

  // Whether to show the canvas layer (has PDF content ready)
  const showCanvas = !!pdfDoc && !pdfLoading && !error;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b bg-card px-3 py-1.5">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handlePrevPage} disabled={currentPage <= 1} aria-label="Previous page">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[5rem] text-center text-sm text-muted-foreground">
            Page {currentPage} / {pageCount || "—"}
          </span>
          <Button variant="ghost" size="icon" onClick={handleNextPage} disabled={currentPage >= pageCount} aria-label="Next page">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="hidden min-w-0 flex-1 justify-center px-2 lg:flex">
          <span
            className="max-w-[22rem] truncate rounded border bg-background px-2 py-1 text-xs text-muted-foreground"
            title={
              selectedStampDefinition
                ? selectedStampDefinition.name
                : `${stampsOnPage.length} stamp${stampsOnPage.length === 1 ? "" : "s"} on this page`
            }
          >
            {selectedStampDefinition
              ? selectedStampDefinition.name
              : `${stampsOnPage.length} stamp${stampsOnPage.length === 1 ? "" : "s"}`}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={handleZoomOut} disabled={zoom <= MIN_ZOOM} aria-label="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="min-w-[3rem] text-center text-sm text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="icon" onClick={handleZoomIn} disabled={zoom >= MAX_ZOOM} aria-label="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={handleDuplicateToAll} disabled={!selectedApplied || pageCount <= 1} title="Apply to all pages">
            <CopyPlus className="h-4 w-4" />
            <span className="hidden sm:inline">All pages</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDelete} disabled={!selectedApplied} title="Delete selected stamp">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="relative flex flex-1 items-start justify-center overflow-auto bg-muted/30 p-8"
      >
        {/* Loading overlay — shown while fetching from storage or parsing PDF */}
        {(fetching || pdfLoading) && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error state */}
        {!fetching && !pdfLoading && error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/*
          Canvas wrapper — always rendered once pdfData exists so that
          pdfCanvasRef and stampCanvasRef are always attached to the DOM.
          Visibility is controlled via opacity/pointer-events so the refs
          are never null when the render effect fires.
        */}
        {pdfData && (
          <div
            className={cn(
              "relative shadow-lg transition-opacity duration-150",
              showCanvas ? "opacity-100" : "opacity-0 pointer-events-none",
              (dragging || resizing >= 0) && "cursor-grabbing",
            )}
            style={{
              width: `${pageSize.width * zoom}px`,
              height: `${pageSize.height * zoom}px`,
            }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {/* PDF render canvas */}
            <canvas
              ref={pdfCanvasRef}
              className="absolute inset-0"
              style={{
                width: `${pageSize.width * zoom}px`,
                height: `${pageSize.height * zoom}px`,
              }}
            />

            {/* Stamp overlay canvas */}
            <canvas
              ref={stampCanvasRef}
              className="absolute inset-0"
              style={{
                width: `${pageSize.width * zoom}px`,
                height: `${pageSize.height * zoom}px`,
                cursor: dragging
                  ? "grabbing"
                  : resizing >= 0
                    ? cursorForHandle(resizing)
                    : overlayCursor,
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onPointerLeave={handlePointerLeave}
            />
          </div>
        )}
      </div>
    </div>
  );
}
