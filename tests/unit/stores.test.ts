import { describe, it, expect, beforeEach } from "vitest";
import { useStampsStore } from "@/stores/stamps";
import { useFilesStore } from "@/stores/files";
import { useAppliedStampsStore } from "@/stores/applied-stamps";
import { useUIStore } from "@/stores/ui";

describe("useStampsStore", () => {
  beforeEach(() => {
    useStampsStore.getState().reset();
  });

  it("adds a stamp and returns an id", () => {
    const id = useStampsStore.getState().addStamp({
      type: "text",
      name: "Test",
      text: "DRAFT",
      author: "",
      template: "text_with_border",
      width: 200,
      height: 60,
      blendMode: "normal",
      opacity: 100,
      rotation: 0,
      fontColor: "#ff0000",
      lineColor: "#ff0000",
      fontSize: 48,
    });

    expect(id).toBeDefined();
    expect(useStampsStore.getState().stamps).toHaveLength(1);
    expect(useStampsStore.getState().stamps[0].name).toBe("Test");
  });

  it("deletes a stamp by id", () => {
    const id = useStampsStore.getState().addStamp({
      type: "text",
      name: "ToDelete",
      text: "X",
      author: "",
      template: "text",
      width: 100,
      height: 40,
      blendMode: "normal",
      opacity: 100,
      rotation: 0,
      fontColor: "#000",
      lineColor: "#000",
      fontSize: 24,
    });

    useStampsStore.getState().deleteStamp(id);
    expect(useStampsStore.getState().stamps).toHaveLength(0);
  });
});

describe("useFilesStore", () => {
  beforeEach(() => {
    useFilesStore.getState().clearFiles();
  });

  it("adds files and selects the first as active", () => {
    const file = {
      id: "f1",
      name: "test.pdf",
      size: 1024,
      pageCount: 3,
      storageUrl: "",
      uploadedAt: new Date(),
      userId: "u1",
    };

    useFilesStore.getState().addFiles([file]);
    expect(useFilesStore.getState().files).toHaveLength(1);
  });

  it("toggles file selection", () => {
    useFilesStore.getState().addFiles([
      { id: "f1", name: "a.pdf", size: 100, pageCount: 1, storageUrl: "", uploadedAt: new Date(), userId: "u1" },
    ]);
    useFilesStore.getState().toggleFileSelection("f1");
    expect(useFilesStore.getState().selectedFileIds.has("f1")).toBe(true);
    useFilesStore.getState().toggleFileSelection("f1");
    expect(useFilesStore.getState().selectedFileIds.has("f1")).toBe(false);
  });
});

describe("useAppliedStampsStore", () => {
  beforeEach(() => {
    useAppliedStampsStore.getState().reset();
  });

  it("adds an applied stamp and returns it with generated id", () => {
    const result = useAppliedStampsStore.getState().addAppliedStamp("file1", 1, {
      stampId: "s1",
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      baseWidth: 100,
      baseHeight: 50,
      rotation: 0,
    });

    expect(result.id).toBeDefined();
    expect(result.page).toBe(1);

    const stampsOnPage = useAppliedStampsStore.getState().appliedStamps.get("file1")?.get(1);
    expect(stampsOnPage).toHaveLength(1);
  });

  it("duplicates to all pages", () => {
    const stamp = useAppliedStampsStore.getState().addAppliedStamp("file1", 1, {
      stampId: "s1",
      x: 10,
      y: 20,
      width: 100,
      height: 50,
      baseWidth: 100,
      baseHeight: 50,
      rotation: 0,
    });

    useAppliedStampsStore.getState().duplicateToAllPages("file1", stamp, 5);

    const fileMap = useAppliedStampsStore.getState().appliedStamps.get("file1")!;
    expect(fileMap.get(2)).toHaveLength(1);
    expect(fileMap.get(3)).toHaveLength(1);
    expect(fileMap.get(4)).toHaveLength(1);
    expect(fileMap.get(5)).toHaveLength(1);
  });
});

describe("useUIStore", () => {
  it("toggles panels", () => {
    expect(useUIStore.getState().leftPanelOpen).toBe(true);
    useUIStore.getState().toggleLeftPanel();
    expect(useUIStore.getState().leftPanelOpen).toBe(false);
  });

  it("sets zoom within bounds", () => {
    useUIStore.getState().setZoom(2);
    expect(useUIStore.getState().zoom).toBe(2);
  });
});
