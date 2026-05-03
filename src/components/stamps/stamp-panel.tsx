"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Type, Image, Layers, Stamp } from "lucide-react";

import { cn } from "@/lib/utils";
import { useStampsStore } from "@/stores/stamps";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { StampPreview } from "./stamp-preview";
import { TextStampForm } from "./text-stamp-form";
import { ImageStampForm } from "./image-stamp-form";
import { DynamicStampForm } from "./dynamic-stamp-form";
import { PrepareStampForm } from "./prepare-stamp-form";

import type { Stamp as StampType, DynamicStamp, PreparedStamp } from "@/types/stampify";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CreateMode = "choose" | "text" | "image" | "dynamic";
type EditMode = { kind: "prepare"; template: DynamicStamp | PreparedStamp };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StampPanel() {
  const stamps = useStampsStore((s) => s.stamps);
  const deleteStamp = useStampsStore((s) => s.deleteStamp);

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>("choose");
  const [editDialog, setEditDialog] = useState<EditMode | null>(null);

  // ---- Create Dialog Handlers ----

  function openCreateDialog() {
    setCreateMode("choose");
    setCreateOpen(true);
  }

  function handleStampCreated() {
    setCreateOpen(false);
    setCreateMode("choose");
  }

  // ---- Edit / Prepare ----

  function handlePrepare(stamp: DynamicStamp | PreparedStamp) {
    setEditDialog({ kind: "prepare", template: stamp });
  }

  function handlePrepared() {
    setEditDialog(null);
  }

  // ---- Delete ----

  function handleDelete(stamp: StampType) {
    deleteStamp(stamp.id);
    toast({ title: "Stamp deleted", description: `"${stamp.name}" has been removed.` });
  }

  // ---- Drag ----

  function handleDragStart(e: React.DragEvent, stamp: StampType) {
    e.dataTransfer.setData("application/stampify-stamp-id", stamp.id);
    e.dataTransfer.effectAllowed = "copy";
  }

  // ---- Helpers ----

  function stampTypeBadge(stamp: StampType) {
    switch (stamp.type) {
      case "text":
        return <Badge variant="secondary" className="text-[10px]">Text</Badge>;
      case "image":
        return <Badge variant="secondary" className="text-[10px]">Image</Badge>;
      case "dynamic":
        return <Badge variant="secondary" className="text-[10px]">Dynamic</Badge>;
      case "prepared":
        return <Badge variant="outline" className="text-[10px]">Prepared</Badge>;
    }
  }

  // ---- Render ----

  return (
    <div className="flex h-full flex-col border-l bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Stamp className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Stamp Library</h2>
          <Badge variant="secondary" className="text-[10px]">
            {stamps.length}
          </Badge>
        </div>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />
          <span className="sr-only">Create stamp</span>
        </Button>
      </div>

      {/* Gallery */}
      <ScrollArea className="flex-1 p-3">
        {stamps.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="rounded-full bg-muted p-3">
              <Stamp className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No stamps yet</p>
              <p className="text-xs text-muted-foreground">
                Create your first stamp to get started.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={openCreateDialog}>
              <Plus className="mr-1 h-3 w-3" />
              Create Stamp
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {stamps.map((stamp) => (
              <div
                key={stamp.id}
                draggable
                onDragStart={(e) => handleDragStart(e, stamp)}
                className="group relative flex cursor-grab flex-col items-center gap-1.5 rounded-lg border border-input bg-card p-2 transition-colors hover:border-primary/50 hover:bg-accent/50 active:cursor-grabbing"
              >
                {/* Preview thumbnail */}
                <StampPreview stamp={stamp} className="h-16 w-full" />

                {/* Name + badge */}
                <div className="flex w-full items-center gap-1">
                  {stampTypeBadge(stamp)}
                  <span className="truncate text-xs font-medium">{stamp.name}</span>
                </div>

                {/* Actions overlay */}
                <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  {(stamp.type === "dynamic" || stamp.type === "prepared") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 bg-background/80 backdrop-blur-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePrepare(stamp as DynamicStamp | PreparedStamp);
                      }}
                      title="Prepare / Edit values"
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 bg-background/80 text-destructive backdrop-blur-sm hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(stamp);
                    }}
                    title="Delete stamp"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* ---- Create Stamp Dialog ---- */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {createMode === "choose" && "Create Stamp"}
              {createMode === "text" && "New Text Stamp"}
              {createMode === "image" && "New Image Stamp"}
              {createMode === "dynamic" && "New Dynamic Stamp"}
            </DialogTitle>
            <DialogDescription>
              {createMode === "choose"
                ? "Choose a stamp type to create."
                : "Fill in the details below."}
            </DialogDescription>
          </DialogHeader>

          {createMode === "choose" && (
            <div className="grid gap-2">
              <button
                type="button"
                className="flex items-center gap-3 rounded-lg border border-input p-3 text-left transition-colors hover:bg-accent"
                onClick={() => setCreateMode("text")}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <Type className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Text Stamp</p>
                  <p className="text-xs text-muted-foreground">
                    Create a stamp with custom text, colors, and borders.
                  </p>
                </div>
              </button>

              <button
                type="button"
                className="flex items-center gap-3 rounded-lg border border-input p-3 text-left transition-colors hover:bg-accent"
                onClick={() => setCreateMode("image")}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <Image className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Image Stamp</p>
                  <p className="text-xs text-muted-foreground">
                    Upload a PNG or JPG image as a stamp.
                  </p>
                </div>
              </button>

              <button
                type="button"
                className="flex items-center gap-3 rounded-lg border border-input p-3 text-left transition-colors hover:bg-accent"
                onClick={() => setCreateMode("dynamic")}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <Layers className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">Dynamic Stamp</p>
                  <p className="text-xs text-muted-foreground">
                    Design a template with configurable fields.
                  </p>
                </div>
              </button>
            </div>
          )}

          {createMode === "text" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="mb-2 w-fit"
                onClick={() => setCreateMode("choose")}
              >
                &larr; Back
              </Button>
              <TextStampForm onStampCreated={handleStampCreated} />
            </>
          )}

          {createMode === "image" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="mb-2 w-fit"
                onClick={() => setCreateMode("choose")}
              >
                &larr; Back
              </Button>
              <ImageStampForm onStampCreated={handleStampCreated} />
            </>
          )}

          {createMode === "dynamic" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="mb-2 w-fit"
                onClick={() => setCreateMode("choose")}
              >
                &larr; Back
              </Button>
              <DynamicStampForm onStampCreated={handleStampCreated} />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ---- Prepare / Edit Dialog ---- */}
      <Dialog
        open={editDialog !== null}
        onOpenChange={(open) => {
          if (!open) setEditDialog(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editDialog?.kind === "prepare" ? "Prepare Stamp" : "Edit Stamp"}
            </DialogTitle>
            <DialogDescription>
              Fill in or update the field values for this stamp.
            </DialogDescription>
          </DialogHeader>

          {editDialog?.kind === "prepare" && (
            <PrepareStampForm
              template={editDialog.template}
              onStampPrepared={handlePrepared}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
