import { describe, expect, it } from "vitest";
import {
  createCustomPreparedStamp,
  createCustomStampTemplateData,
  CUSTOM_STAMP_PRESETS,
  getCustomStampImageSources,
  isCustomBlockStamp,
  resolveCustomStampData,
} from "@/lib/stamps/custom-template";

describe("custom block stamp templates", () => {
  it("creates a prepared stamp saved under the selected state and purpose", () => {
    const data = createCustomStampTemplateData({
      state: "Florida",
      purpose: "Code Review",
      width: 320,
      height: 180,
      backgroundColor: "transparent",
      padding: 16,
      blocks: [],
    });

    const stamp = {
      ...createCustomPreparedStamp(data),
      id: "custom-1",
    };

    expect(stamp.name).toBe("Florida - Code Review");
    expect(stamp.templateId).toBe("custom-block-template");
    expect(isCustomBlockStamp(stamp)).toBe(true);
    expect(resolveCustomStampData(stamp).state).toBe("Florida");
  });

  it("keeps starter presets available for reusable state templates", () => {
    expect(CUSTOM_STAMP_PRESETS.map((preset) => preset.id)).toEqual(
      expect.arrayContaining(["florida-simple", "florida-detailed"]),
    );
  });

  it("collects uploaded logo and signature images for rendering", () => {
    const data = createCustomStampTemplateData({
      state: "General",
      purpose: "Images",
      width: 300,
      height: 200,
      backgroundColor: "transparent",
      padding: 12,
      blocks: [
        {
          id: "logo",
          type: "logo",
          logoKind: "uploaded",
          imageDataUrl: "data:image/png;base64,logo",
          width: 60,
          height: 60,
          align: "left",
        },
        {
          id: "signature",
          type: "signature",
          signerName: "Reviewer",
          imageDataUrl: "data:image/png;base64,signature",
          width: 120,
          height: 40,
          color: "#111111",
          fontSize: 14,
          align: "left",
        },
      ],
    });
    const stamp = {
      ...createCustomPreparedStamp(data),
      id: "custom-2",
    };

    expect(getCustomStampImageSources(stamp)).toEqual([
      "data:image/png;base64,logo",
      "data:image/png;base64,signature",
    ]);
  });
});
