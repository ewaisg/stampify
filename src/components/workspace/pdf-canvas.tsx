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

// ---------------------------------------------------------------------------
// PDF.js worker — served from /public so it is always available, no CDN dep
// ---------------------------------------------------------------------------

pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HANDLE_SIZE = 8;
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
) {
  const x = applied.x * zoom;
  const y = applied.y * zoom;
  const w = applied.width * zoom;
  const h = applied.height * zoom;

  ctx.save();

  if (applied.rotation) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.translate(cx, cy);
    ctx.rotate((applied.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  if (stamp.type === "text") {
    ctx.globalAlpha = stamp.opacity / 100;

    if (
      stamp.template === "text_with_border" ||
      stamp.template === "text_with_date_and_border"
    ) {
      ctx.strokeStyle = stamp.lineColor;
      ctx.lineWidth = 2 * zoom;
      ctx.strokeRect(x, y, w, h);
    } else if (stamp.template === "text_with_rounded_border") {
      ctx.strokeStyle = stamp.lineColor;
      ctx.lineWidth = 2 * zoom;
      const r = 6 * zoom;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.stroke();
    }

    ctx.fillStyle = stamp.fontColor;
    ctx.font = `bold ${stamp.fontSize * zoom}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(stamp.text, x + w / 2, y + h / 2, w - 8 * zoom);
    ctx.globalAlpha = 1;
  } else if (stamp.type === "dynamic" || stamp.type === "prepared") {
    ctx.fillStyle = stamp.backgroundColor || "#f0f0f0";
    ctx.globalAlpha = 0.9;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1 * zoom;
    ctx.strokeRect(x, y, w, h);

    const data = applied.data ?? {};
    const fields = stamp.fields;
    const lineHeight = Math.min(h / Math.max(fields.length, 1), 20 * zoom);
    ctx.fillStyle = "#333";
    ctx.font = `${12 * zoom}px sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    fields.forEach((field, i) => {
      let displayText = field.label + ": ";
      displayText += field.type === "staticText" ? field.value : (data[field.id] ?? "");
      ctx.fillText(displayText, x + 4 * zoom, y + 4 * zoom + i * lineHeight, w - 8 * zoom);
    });
  } else if (stamp.type === "image") {
    ctx.fillStyle = "#e0e0e0";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 1 * zoom;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "#999";
    ctx.font = `${11 * zoom}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("[Image]", x + w / 2, y + h / 2);
  }

  if (isSelected) {
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
    ctx.setLineDash([]);

    ctx.fillStyle = "#2563eb";
    for (const [hx, hy] of [
      [x - HANDLE_SIZE / 2, y - HANDLE_SIZE / 2],
      [x + w - HANDLE_SIZE / 2, y - HANDLE_SIZE / 2],
      [x - HANDLE_SIZE / 2, y + h - HANDLE_SIZE / 2],
      [x + w - HANDLE_SIZE / 2, y + h - HANDLE_SIZE / 2],
    ]) {
      ctx.fillRect(hx, hy, HANDLE_SIZE, HANDLE_SIZE);
    }
  }

  ctx.restore();
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
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragStampOrigin, setDragStampOrigin] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const stampCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fileId = activeFileId ?? "";
  const stampsOnPage = useMemo(() => {
    if (!fileId) return [];
    return selectStampsForPage({ appliedStamps }, fileId, currentPage);
  }, [appliedStamps, fileId, currentPage]);

  const selectedApplied = useMemo(
    () => stampsOnPage.find((s) => s.id === selectedStampId) ?? null,
    [stampsOnPage, selectedStampId],
  );

  useEffect(() => {
    setTotalPages(pageCount);
  }, [pageCount, setTotalPages]);

  // -----------------------------------------------------------------------
  // Load PDF document
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!pdfData) {
      setPdfDoc(null);
      setPageCount(0);
      setError(null);
      return;
    }

    let cancelled = false;
    setPdfLoading(true);
    setError(null);
    setPdfDoc(null);

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
      drawStampOnCanvas(ctx, stampDef, applied, zoom, applied.id === selectedStampId);
    }
  }, [stampsOnPage, stamps, zoom, selectedStampId, pageSize]);

  useEffect(() => {
    renderStampOverlay();
  }, [renderStampOverlay]);

  // -----------------------------------------------------------------------
  // Mouse handlers
  // -----------------------------------------------------------------------

  const getCanvasCoords = useCallback((e: React.MouseEvent) => {
    const canvas = stampCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!fileId) return;
      const { x, y } = getCanvasCoords(e);

      if (selectedApplied) {
        const handleIdx = hitTestHandle(x, y, selectedApplied, zoom);
        if (handleIdx >= 0) {
          setResizing(handleIdx);
          setDragStart({ x, y });
          setDragStampOrigin({ x: selectedApplied.x, y: selectedApplied.y, width: selectedApplied.width, height: selectedApplied.height });
          return;
        }
      }

      for (let i = stampsOnPage.length - 1; i >= 0; i--) {
        const applied = stampsOnPage[i];
        if (hitTestStamp(x, y, applied, zoom)) {
          setSelectedStampId(applied.id);
          setDragging(true);
          setDragStart({ x, y });
          setDragStampOrigin({ x: applied.x, y: applied.y, width: applied.width, height: applied.height });
          return;
        }
      }

      setSelectedStampId(null);
    },
    [fileId, getCanvasCoords, selectedApplied, stampsOnPage, zoom],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!fileId || !dragStart || !dragStampOrigin || !selectedStampId) return;

      const { x, y } = getCanvasCoords(e);
      const dx = (x - dragStart.x) / zoom;
      const dy = (y - dragStart.y) / zoom;
      const applied = stampsOnPage.find((s) => s.id === selectedStampId);
      if (!applied) return;

      if (dragging) {
        updateAppliedStamp(fileId, currentPage, {
          ...applied,
          x: Math.max(0, dragStampOrigin.x + dx),
          y: Math.max(0, dragStampOrigin.y + dy),
        });
      } else if (resizing >= 0) {
        let newX = dragStampOrigin.x;
        let newY = dragStampOrigin.y;
        let newW = dragStampOrigin.width;
        let newH = dragStampOrigin.height;

        if (resizing === 0) { newX += dx; newY += dy; newW -= dx; newH -= dy; }
        else if (resizing === 1) { newY += dy; newW += dx; newH -= dy; }
        else if (resizing === 2) { newX += dx; newW -= dx; newH += dy; }
        else if (resizing === 3) { newW += dx; newH += dy; }

        if (newW < MIN_STAMP_SIZE) {
          newW = MIN_STAMP_SIZE;
          if (resizing === 0 || resizing === 2) newX = dragStampOrigin.x + dragStampOrigin.width - MIN_STAMP_SIZE;
        }
        if (newH < MIN_STAMP_SIZE) {
          newH = MIN_STAMP_SIZE;
          if (resizing === 0 || resizing === 1) newY = dragStampOrigin.y + dragStampOrigin.height - MIN_STAMP_SIZE;
        }

        updateAppliedStamp(fileId, currentPage, { ...applied, x: Math.max(0, newX), y: Math.max(0, newY), width: newW, height: newH });
      }
    },
    [fileId, dragStart, dragStampOrigin, selectedStampId, dragging, resizing, getCanvasCoords, zoom, stampsOnPage, updateAppliedStamp, currentPage],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
    setResizing(-1);
    setDragStart(null);
    setDragStampOrigin(null);
  }, []);

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
  }, [fileId, selectedStampId, currentPage, deleteAppliedStamp]);

  const handleDuplicateToAll = useCallback(() => {
    if (!fileId || !selectedApplied || pageCount === 0) return;
    duplicateToAllPages(fileId, selectedApplied, pageCount);
  }, [fileId, selectedApplied, pageCount, duplicateToAllPages]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) { setCurrentPage(currentPage - 1); setSelectedStampId(null); }
  }, [currentPage, setCurrentPage]);

  const handleNextPage = useCallback(() => {
    if (currentPage < pageCount) { setCurrentPage(currentPage + 1); setSelectedStampId(null); }
  }, [currentPage, pageCount, setCurrentPage]);

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
                cursor: dragging ? "grabbing" : resizing >= 0 ? "nwse-resize" : "default",
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>
        )}
      </div>
    </div>
  );
}
