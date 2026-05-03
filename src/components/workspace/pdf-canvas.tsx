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
// PDF.js worker configuration
// ---------------------------------------------------------------------------

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.mjs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HANDLE_SIZE = 8;
const PDF_RENDER_SCALE = 2; // Internal render resolution multiplier

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Draw a single applied stamp onto the overlay canvas context. */
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

  // Rotation around center
  if (applied.rotation) {
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.translate(cx, cy);
    ctx.rotate((applied.rotation * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }

  // Draw stamp content based on type
  if (stamp.type === "text") {
    const opacity = stamp.opacity / 100;
    ctx.globalAlpha = opacity;

    // Background / border
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

    // Text
    ctx.fillStyle = stamp.fontColor;
    const fontSize = stamp.fontSize * zoom;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(stamp.text, x + w / 2, y + h / 2, w - 8 * zoom);

    ctx.globalAlpha = 1;
  } else if (stamp.type === "dynamic" || stamp.type === "prepared") {
    // Render dynamic stamp with background and field data
    ctx.fillStyle = stamp.backgroundColor || "#f0f0f0";
    ctx.globalAlpha = 0.9;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1 * zoom;
    ctx.strokeRect(x, y, w, h);

    // Render field values
    const data = applied.data ?? {};
    const fields = stamp.fields;
    const lineHeight = Math.min(h / Math.max(fields.length, 1), 20 * zoom);
    ctx.fillStyle = "#333";
    ctx.font = `${12 * zoom}px sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    fields.forEach((field, i) => {
      let displayText = field.label + ": ";
      if (field.type === "staticText") {
        displayText += field.value;
      } else {
        displayText += data[field.id] ?? "";
      }
      ctx.fillText(
        displayText,
        x + 4 * zoom,
        y + 4 * zoom + i * lineHeight,
        w - 8 * zoom,
      );
    });
  } else if (stamp.type === "image") {
    // Image stamps are rendered asynchronously; draw a placeholder rectangle
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

  // Selection outline + resize handles
  if (isSelected) {
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
    ctx.setLineDash([]);

    // Corner handles
    const corners = [
      [x - HANDLE_SIZE / 2, y - HANDLE_SIZE / 2],
      [x + w - HANDLE_SIZE / 2, y - HANDLE_SIZE / 2],
      [x - HANDLE_SIZE / 2, y + h - HANDLE_SIZE / 2],
      [x + w - HANDLE_SIZE / 2, y + h - HANDLE_SIZE / 2],
    ];
    ctx.fillStyle = "#2563eb";
    for (const [hx, hy] of corners) {
      ctx.fillRect(hx, hy, HANDLE_SIZE, HANDLE_SIZE);
    }
  }

  ctx.restore();
}

/** Check if a point falls on a corner resize handle. Returns corner index or -1. */
function hitTestHandle(
  px: number,
  py: number,
  applied: AppliedStamp,
  zoom: number,
): number {
  const x = applied.x * zoom;
  const y = applied.y * zoom;
  const w = applied.width * zoom;
  const h = applied.height * zoom;
  const hs = HANDLE_SIZE + 4; // add some padding for easier grabbing

  const corners = [
    [x, y],
    [x + w, y],
    [x, y + h],
    [x + w, y + h],
  ];

  for (let i = 0; i < corners.length; i++) {
    const [cx, cy] = corners[i];
    if (
      px >= cx - hs / 2 &&
      px <= cx + hs / 2 &&
      py >= cy - hs / 2 &&
      py <= cy + hs / 2
    ) {
      return i;
    }
  }
  return -1;
}

/** Check if a point falls within a stamp's bounding box. */
function hitTestStamp(
  px: number,
  py: number,
  applied: AppliedStamp,
  zoom: number,
): boolean {
  const x = applied.x * zoom;
  const y = applied.y * zoom;
  const w = applied.width * zoom;
  const h = applied.height * zoom;
  return px >= x && px <= x + w && py >= y && py <= y + h;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PdfCanvasProps {
  pdfData: ArrayBuffer | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PdfCanvas({ pdfData }: PdfCanvasProps) {
  // Stores
  const { currentPage, setCurrentPage, zoom, setZoom, setTotalPages, selectedStampId, setSelectedStampId } = useUIStore();
  const { activeFileId } = useFilesStore();
  const stamps = useStampsStore((s) => s.stamps);
  const appliedStamps = useAppliedStampsStore((s) => s.appliedStamps);

  // Firestore-persisted actions
  const {
    addStamp: addAppliedStamp,
    updateStamp: updateAppliedStamp,
    deleteStamp: deleteAppliedStamp,
    duplicateToAll: duplicateToAllPages,
  } = useAppliedStampActions();

  // PDF state
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({
    width: 612,
    height: 792,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Interaction state
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState<number>(-1); // corner index
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragStampOrigin, setDragStampOrigin] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Refs
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const stampCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Derived state
  const fileId = activeFileId ?? "";
  const stampsOnPage = useMemo(() => {
    if (!fileId) return [];
    return selectStampsForPage({ appliedStamps }, fileId, currentPage);
  }, [appliedStamps, fileId, currentPage]);

  const selectedApplied = useMemo(
    () => stampsOnPage.find((s) => s.id === selectedStampId) ?? null,
    [stampsOnPage, selectedStampId],
  );

  // Sync pageCount to UI store so other components can access it
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
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const loadTask = pdfjsLib.getDocument({ data: pdfData.slice(0) });

    loadTask.promise
      .then((doc) => {
        if (cancelled) return;
        setPdfDoc(doc);
        setPageCount(doc.numPages);
        setCurrentPage(1);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load PDF:", err);
        setError("Failed to load PDF document.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pdfData, setCurrentPage]);

  // -----------------------------------------------------------------------
  // Render PDF page
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!pdfDoc || !pdfCanvasRef.current) return;
    if (currentPage < 1 || currentPage > pdfDoc.numPages) return;

    let cancelled = false;

    pdfDoc.getPage(currentPage).then((page) => {
      if (cancelled) return;

      const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
      setPageSize({
        width: viewport.width / PDF_RENDER_SCALE,
        height: viewport.height / PDF_RENDER_SCALE,
      });

      const canvas = pdfCanvasRef.current!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${(viewport.width / PDF_RENDER_SCALE) * zoom}px`;
      canvas.style.height = `${(viewport.height / PDF_RENDER_SCALE) * zoom}px`;

      const ctx = canvas.getContext("2d")!;
      const renderTask = page.render({ canvasContext: ctx, viewport });
      renderTask.promise.catch((err: unknown) => {
        if (!cancelled) console.error("PDF render error:", err);
      });
    });

    return () => {
      cancelled = true;
    };
  // pdfData included so the effect re-fires when a new file is loaded
  // even if currentPage stays at 1 from the previous file
  }, [pdfDoc, currentPage, zoom, pdfData]);

  // -----------------------------------------------------------------------
  // Render stamp overlay
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

      drawStampOnCanvas(
        ctx,
        stampDef,
        applied,
        zoom,
        applied.id === selectedStampId,
      );
    }
  }, [stampsOnPage, stamps, zoom, selectedStampId, pageSize]);

  useEffect(() => {
    renderStampOverlay();
  }, [renderStampOverlay]);

  // -----------------------------------------------------------------------
  // Mouse interaction handlers
  // -----------------------------------------------------------------------

  const getCanvasCoords = useCallback(
    (e: React.MouseEvent): { x: number; y: number } => {
      const canvas = stampCanvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    [],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!fileId) return;
      const { x, y } = getCanvasCoords(e);

      // Check if clicking on a resize handle of the selected stamp
      if (selectedApplied) {
        const handleIdx = hitTestHandle(x, y, selectedApplied, zoom);
        if (handleIdx >= 0) {
          setResizing(handleIdx);
          setDragStart({ x, y });
          setDragStampOrigin({
            x: selectedApplied.x,
            y: selectedApplied.y,
            width: selectedApplied.width,
            height: selectedApplied.height,
          });
          return;
        }
      }

      // Check if clicking on any stamp (reverse order so topmost is selected first)
      for (let i = stampsOnPage.length - 1; i >= 0; i--) {
        const applied = stampsOnPage[i];
        if (hitTestStamp(x, y, applied, zoom)) {
          setSelectedStampId(applied.id);
          setDragging(true);
          setDragStart({ x, y });
          setDragStampOrigin({
            x: applied.x,
            y: applied.y,
            width: applied.width,
            height: applied.height,
          });
          return;
        }
      }

      // Click on empty area — deselect
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
        // Move stamp
        updateAppliedStamp(fileId, currentPage, {
          ...applied,
          x: Math.max(0, dragStampOrigin.x + dx),
          y: Math.max(0, dragStampOrigin.y + dy),
        });
      } else if (resizing >= 0) {
        // Resize stamp from corner
        let newX = dragStampOrigin.x;
        let newY = dragStampOrigin.y;
        let newW = dragStampOrigin.width;
        let newH = dragStampOrigin.height;

        // Corner indices: 0=TL, 1=TR, 2=BL, 3=BR
        if (resizing === 0) {
          newX = dragStampOrigin.x + dx;
          newY = dragStampOrigin.y + dy;
          newW = dragStampOrigin.width - dx;
          newH = dragStampOrigin.height - dy;
        } else if (resizing === 1) {
          newY = dragStampOrigin.y + dy;
          newW = dragStampOrigin.width + dx;
          newH = dragStampOrigin.height - dy;
        } else if (resizing === 2) {
          newX = dragStampOrigin.x + dx;
          newW = dragStampOrigin.width - dx;
          newH = dragStampOrigin.height + dy;
        } else if (resizing === 3) {
          newW = dragStampOrigin.width + dx;
          newH = dragStampOrigin.height + dy;
        }

        // Enforce minimum size
        if (newW < MIN_STAMP_SIZE) {
          newW = MIN_STAMP_SIZE;
          if (resizing === 0 || resizing === 2) {
            newX = dragStampOrigin.x + dragStampOrigin.width - MIN_STAMP_SIZE;
          }
        }
        if (newH < MIN_STAMP_SIZE) {
          newH = MIN_STAMP_SIZE;
          if (resizing === 0 || resizing === 1) {
            newY = dragStampOrigin.y + dragStampOrigin.height - MIN_STAMP_SIZE;
          }
        }

        updateAppliedStamp(fileId, currentPage, {
          ...applied,
          x: Math.max(0, newX),
          y: Math.max(0, newY),
          width: newW,
          height: newH,
        });
      }
    },
    [
      fileId,
      dragStart,
      dragStampOrigin,
      selectedStampId,
      dragging,
      resizing,
      getCanvasCoords,
      zoom,
      stampsOnPage,
      updateAppliedStamp,
      currentPage,
    ],
  );

  const handleMouseUp = useCallback(() => {
    setDragging(false);
    setResizing(-1);
    setDragStart(null);
    setDragStampOrigin(null);
  }, []);

  // -----------------------------------------------------------------------
  // Drop zone — accept stamps dragged from the stamp panel
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

      // TODO: For dynamic stamps, show a preparation dialog before placing.
      // For now, dynamic stamps are placed with empty data.

      const canvas = stampCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dropX = (e.clientX - rect.left) / zoom;
      const dropY = (e.clientY - rect.top) / zoom;

      // Center the stamp on the drop point
      const placedX = Math.max(0, dropX - stampDef.width / 2);
      const placedY = Math.max(0, dropY - stampDef.height / 2);

      const rotation =
        stampDef.type === "text" ? stampDef.rotation : 0;

      addAppliedStamp(fileId, currentPage, {
        stampId: stampDef.id,
        x: placedX,
        y: placedY,
        width: stampDef.width,
        height: stampDef.height,
        baseWidth: stampDef.width,
        baseHeight: stampDef.height,
        rotation,
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
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      setSelectedStampId(null);
    }
  }, [currentPage, setCurrentPage]);

  const handleNextPage = useCallback(() => {
    if (currentPage < pageCount) {
      setCurrentPage(currentPage + 1);
      setSelectedStampId(null);
    }
  }, [currentPage, pageCount, setCurrentPage]);

  const handleZoomIn = useCallback(() => {
    setZoom(Math.min(MAX_ZOOM, zoom + ZOOM_INCREMENT));
  }, [zoom, setZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom(Math.max(MIN_ZOOM, zoom - ZOOM_INCREMENT));
  }, [zoom, setZoom]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (!pdfData) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <p>Upload a PDF to get started.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center justify-between border-b bg-card px-3 py-1.5">
        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[5rem] text-center text-sm text-muted-foreground">
            Page {currentPage} / {pageCount}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextPage}
            disabled={currentPage >= pageCount}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="min-w-[3rem] text-center text-sm text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        {/* Stamp actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDuplicateToAll}
            disabled={!selectedApplied || pageCount <= 1}
            title="Apply to all pages"
          >
            <CopyPlus className="h-4 w-4" />
            <span className="hidden sm:inline">All pages</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={!selectedApplied}
            title="Delete selected stamp"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Canvas area */}
      <div
        ref={containerRef}
        className="flex flex-1 items-start justify-center overflow-auto bg-muted/30 p-8"
      >
        <div
          className={cn(
            "relative shadow-lg",
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
                  ? "nwse-resize"
                  : "default",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>
      </div>
    </div>
  );
}
