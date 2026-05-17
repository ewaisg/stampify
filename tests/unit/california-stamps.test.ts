import { describe, expect, it } from "vitest";
import {
  calculateCaliforniaExpirationDate,
  createCaliforniaStampData,
  getCaliforniaDefaultAppliedSize,
} from "@/lib/stamps/california";

describe("California stamp templates", () => {
  it("calculates FBH expiration as three years from approval date minus one day", () => {
    expect(
      calculateCaliforniaExpirationDate("ca-fbh-wo-foundation", "2024-05-02"),
    ).toBe("2027-05-01");
  });

  it("calculates commercial expiration as fifteen months from approval date minus one day", () => {
    expect(
      calculateCaliforniaExpirationDate(
        "ca-commercial-wo-foundation",
        "2024-10-16",
      ),
    ).toBe("2026-01-15");
  });

  it("creates data with template defaults and editable override values", () => {
    const data = createCaliforniaStampData("ca-cm-fbh", {
      planApproval: "R-21346",
      approvalDate: "2024-05-02",
    });

    expect(data.title).toBe("Approved for Factory Built Housing Only");
    expect(data.planApproval).toBe("R-21346");
    expect(data.expirationDate).toBe("2027-05-01");
    expect(data.addressLine2).toBe("Orlando, FL 32839");
  });

  it("keeps an uploaded logo data URL in the stamp data", () => {
    const data = createCaliforniaStampData("ca-cm-fbh", {
      logoDataUrl: "data:image/png;base64,abc123",
    });

    expect(data.logoDataUrl).toBe("data:image/png;base64,abc123");
  });

  it("uses a smaller default placement size while preserving aspect ratio", () => {
    const size = getCaliforniaDefaultAppliedSize("ca-cm-fbh", 612);

    expect(size.width).toBe(240);
    expect(size.height).toBeCloseTo(167.44, 2);
  });

  it("supports compact and large placement size presets", () => {
    const compact = getCaliforniaDefaultAppliedSize("ca-cm-fbh", 612, "compact");
    const large = getCaliforniaDefaultAppliedSize("ca-cm-fbh", 612, "large");

    expect(compact.width).toBe(200);
    expect(large.width).toBe(280);
    expect(compact.height).toBeCloseTo(139.53, 2);
    expect(large.height).toBeCloseTo(195.35, 2);
  });
});
