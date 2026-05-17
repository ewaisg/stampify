"use client";

import { useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Type,
  Image as ImageIcon,
  Layers,
  Stamp,
  Sparkles,
} from "lucide-react";

import { useStampsStore } from "@/stores/stamps";
import { useStampActions } from "@/hooks/use-stamp-actions";
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
import { PrepareStampForm } from "./prepare-stamp-form";
import { AIPlacementDialog } from "./ai-placement-dialog";
import { CustomStampBuilderForm } from "./custom-stamp-builder-form";
import {
  getCustomStampState,
  isCustomBlockStamp,
  resolveCustomStampData,
} from "@/lib/stamps/custom-template";
import { isCaliforniaStamp } from "@/lib/stamps/california";

import type { Stamp as StampType, DynamicStamp, PreparedStamp } from "@/types/stampify";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CreateMode = "choose" | "text" | "image" | "builder";
type EditMode =
  | { kind: "prepare"; template: DynamicStamp | PreparedStamp }
  | { kind: "builder"; template: PreparedStamp };
type AIMode = { stamp: StampType };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StampPanel() {
  const stamps = useStampsStore((s) => s.stamps);
  const { removeStamp } = useStampActions();

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>("choose");
  const [editDialog, setEditDialog] = useState<EditMode | null>(null);
  const [aiDialog, setAIDialog] = useState<AIMode | null>(null);
  const groupedStamps = useMemo(() => {
    const groups = new Map<string, StampType[]>();

    for (const stamp of stamps) {
      const group = getStampCollectionName(stamp);
      groups.set(group, [...(groups.get(group) ?? []), stamp]);
    }

    return [...groups.entries()].sort(([a], [b]) => {
      if (a === "General") return 1;
      if (b === "General") return -1;
      return a.localeCompare(b);
    });
  }, [stamps]);

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
    if (stamp.type === "prepared" && isCustomBlockStamp(stamp)) {
      setEditDialog({ kind: "builder", template: stamp });
      return;
    }

    setEditDialog({ kind: "prepare", template: stamp });
  }

  function handlePrepared() {
    setEditDialog(null);
  }

  // ---- Delete ----

  async function handleDelete(stamp: StampType) {
    const ok = await removeStamp(stamp.id);
    if (ok) {
      toast({ title: "Stamp deleted", description: `"${stamp.name}" has been removed.` });
    }
  }

  // ---- Drag ----

  function handleDragStart(e: React.DragEvent, stamp: StampType) {
    e.dataTransfer.setData("application/stampify-stamp-id", stamp.id);
    e.dataTransfer.effectAllowed = "copy";
  }

  // ---- Helpers ----

  function stampTypeBadge(stamp: StampType) {
    if (isCustomBlockStamp(stamp)) {
      return <Badge variant="outline" className="text-[10px]">Template</Badge>;
    }

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

  function getStampCollectionName(stamp: StampType): string {
    const customState = getCustomStampState(stamp);
    if (customState) return customState;
    if (isCaliforniaStamp(stamp)) return "California";
    return "General";
  }

  function getStampSubtitle(stamp: StampType): string | null {
    if (!isCustomBlockStamp(stamp)) return null;
    return resolveCustomStampData(stamp).purpose;
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
          <div className="space-y-4">
            {groupedStamps.map(([group, groupStamps]) => (
              <section key={group} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                    {group}
                  </h3>
                  <Badge variant="secondary" className="text-[10px]">
                    {groupStamps.length}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {groupStamps.map((stamp) => (
                    <div
                      key={stamp.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, stamp)}
                      className="group relative flex cursor-grab flex-col items-center gap-1.5 rounded-lg border border-input bg-card p-2 transition-colors hover:border-primary/50 hover:bg-accent/50 active:cursor-grabbing"
                    >
                      <StampPreview stamp={stamp} className="h-16 w-full" />

                      <div className="flex w-full items-center gap-1">
                        {stampTypeBadge(stamp)}
                        <span className="truncate text-xs font-medium">
                          {stamp.name}
                        </span>
                      </div>

                      {getStampSubtitle(stamp) && (
                        <p className="w-full truncate text-[10px] text-muted-foreground">
                          {getStampSubtitle(stamp)}
                        </p>
                      )}

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
                            title={
                              isCustomBlockStamp(stamp)
                                ? "Edit template"
                                : "Prepare / Edit values"
                            }
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 bg-background/80 text-primary backdrop-blur-sm hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAIDialog({ stamp });
                          }}
                          title="Place with AI on all pages"
                        >
                          <Sparkles className="h-3 w-3" />
                        </Button>
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
              </section>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* ---- Create Stamp Dialog ---- */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent
          className={
            createMode === "builder"
              ? "max-h-[88vh] overflow-y-auto overflow-x-hidden sm:max-w-4xl"
              : "max-h-[85vh] overflow-y-auto sm:max-w-md"
          }
        >
          <DialogHeader>
            <DialogTitle>
              {createMode === "choose" && "Create Stamp"}
              {createMode === "text" && "New Text Stamp"}
              {createMode === "image" && "New Image Stamp"}
              {createMode === "builder" && "State Stamp Builder"}
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
                  <ImageIcon className="h-5 w-5 text-primary" />
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
                onClick={() => setCreateMode("builder")}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                  <Layers className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">State Stamp Builder</p>
                  <p className="text-xs text-muted-foreground">
                    Build reusable state templates from logo, text, date, and signature blocks.
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

          {createMode === "builder" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="mb-2 w-fit"
                onClick={() => setCreateMode("choose")}
              >
                &larr; Back
              </Button>
              <CustomStampBuilderForm onComplete={handleStampCreated} />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ---- AI Placement Dialog ---- */}
      <AIPlacementDialog
        stamp={aiDialog?.stamp ?? null}
        open={aiDialog !== null}
        onOpenChange={(open) => {
          if (!open) setAIDialog(null);
        }}
      />

      {/* ---- Prepare / Edit Dialog ---- */}
      <Dialog
        open={editDialog !== null}
        onOpenChange={(open) => {
          if (!open) setEditDialog(null);
        }}
      >
        <DialogContent
          className={
            editDialog?.kind === "builder"
              ? "max-h-[88vh] overflow-y-auto overflow-x-hidden sm:max-w-4xl"
              : "max-h-[85vh] overflow-y-auto sm:max-w-md"
          }
        >
          <DialogHeader>
            <DialogTitle>
              {editDialog?.kind === "builder" ? "Edit Template" : "Prepare Stamp"}
            </DialogTitle>
            <DialogDescription>
              {editDialog?.kind === "builder"
                ? "Update this saved state stamp template."
                : "Fill in or update the field values for this stamp."}
            </DialogDescription>
          </DialogHeader>

          {editDialog?.kind === "prepare" && (
            <PrepareStampForm
              template={editDialog.template}
              onStampPrepared={handlePrepared}
            />
          )}

          {editDialog?.kind === "builder" && (
            <CustomStampBuilderForm
              stamp={editDialog.template}
              onComplete={handlePrepared}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
