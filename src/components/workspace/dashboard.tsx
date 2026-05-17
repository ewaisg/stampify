"use client";

import type { ComponentType } from "react";
import {
  Archive,
  Box,
  CalendarDays,
  FileText,
  FolderOpen,
  Stamp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAppliedStampsStore } from "@/stores/applied-stamps";
import { useFilesStore } from "@/stores/files";
import { useStampsStore } from "@/stores/stamps";
import { useUIStore } from "@/stores/ui";
import { getCustomStampState } from "@/lib/stamps/custom-template";
import { isCaliforniaStamp } from "@/lib/stamps/california";
import type { Stamp as StampType } from "@/types/stampify";

function countAppliedStampsForFile(
  appliedStamps: Map<string, Map<number, { id: string }[]>>,
  fileId: string,
): number {
  const pageMap = appliedStamps.get(fileId);
  if (!pageMap) return 0;

  let count = 0;
  for (const stamps of pageMap.values()) {
    count += stamps.length;
  }
  return count;
}

function collectionNameForStamp(stamp: StampType): string {
  const customState = getCustomStampState(stamp);
  if (customState) return customState;
  if (isCaliforniaStamp(stamp)) return "California";
  return "General";
}

function formatDate(date: Date | string | number): string {
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) return "Unknown date";
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function Dashboard() {
  const files = useFilesStore((s) => s.files);
  const stamps = useStampsStore((s) => s.stamps);
  const appliedStamps = useAppliedStampsStore((s) => s.appliedStamps);
  const setWorkspaceView = useUIStore((s) => s.setWorkspaceView);

  const stampedFileCount = files.filter(
    (file) => countAppliedStampsForFile(appliedStamps, file.id) > 0,
  ).length;
  const pendingFileCount = Math.max(0, files.length - stampedFileCount);

  const templateCollections = stamps.reduce<Record<string, number>>((acc, stamp) => {
    const collection = collectionNameForStamp(stamp);
    acc[collection] = (acc[collection] ?? 0) + 1;
    return acc;
  }, {});

  const recentFiles = [...files]
    .sort((a, b) => {
      const aTime = new Date(a.uploadedAt).getTime();
      const bTime = new Date(b.uploadedAt).getTime();
      return bTime - aTime;
    })
    .slice(0, 6);

  return (
    <div className="flex h-full flex-col overflow-auto bg-muted/10">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Active files, stamp templates, and completed-work tracking.
            </p>
          </div>
          <Button onClick={() => setWorkspaceView("stamping")}>
            <Stamp className="h-4 w-4" />
            Open Stamping Tool
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            icon={FileText}
            label="Active files"
            value={files.length}
          />
          <MetricCard
            icon={Stamp}
            label="Stamped in workspace"
            value={stampedFileCount}
          />
          <MetricCard
            icon={FolderOpen}
            label="Pending files"
            value={pendingFileCount}
          />
          <MetricCard
            icon={Archive}
            label="Saved templates"
            value={stamps.length}
          />
        </div>

        <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
          <Card className="min-w-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Active Workspace Files</CardTitle>
              <CardDescription>
                These are still in the stamping tool file panel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentFiles.length > 0 ? (
                recentFiles.map((file) => {
                  const appliedCount = countAppliedStampsForFile(
                    appliedStamps,
                    file.id,
                  );

                  return (
                    <div
                      key={file.id}
                      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {file.pageCount} page{file.pageCount === 1 ? "" : "s"} ·{" "}
                          {formatDate(file.uploadedAt)}
                        </p>
                      </div>
                      <Badge variant={appliedCount > 0 ? "secondary" : "outline"}>
                        {appliedCount > 0 ? "Stamped" : "Pending"}
                      </Badge>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-md border border-dashed p-6 text-center">
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground/60" />
                  <p className="mt-2 text-sm font-medium">No active files</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setWorkspaceView("stamping")}
                  >
                    Open Stamping Tool
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Template Collections</CardTitle>
                <CardDescription>
                  Saved templates grouped by state or collection.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(templateCollections).length > 0 ? (
                  Object.entries(templateCollections)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([collection, count]) => (
                      <div
                        key={collection}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                      >
                        <span>{collection}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No saved templates yet.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Completed Files</CardTitle>
                <CardDescription>
                  This module will store stamped history by state and date.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Group by completion date
                </div>
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Filter by state or collection
                </div>
                <div className="flex items-center gap-2">
                  <Box className="h-4 w-4" />
                  Track future Box sync status
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
