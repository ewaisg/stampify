import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn()", () => {
  it("merges multiple class strings", () => {
    const result = cn("foo", "bar", "baz");
    expect(result).toBe("foo bar baz");
  });

  it("handles undefined and falsy values", () => {
    const result = cn("foo", undefined, null, false, "bar");
    expect(result).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    const isActive = true;
    const isDisabled = false;
    const result = cn("base", isActive && "active", isDisabled && "disabled");
    expect(result).toBe("base active");
  });

  it("merges Tailwind classes without conflict", () => {
    const result = cn("text-red-500", "bg-blue-200", "p-4");
    expect(result).toBe("text-red-500 bg-blue-200 p-4");
  });

  it("resolves conflicting Tailwind padding classes (last wins)", () => {
    const result = cn("p-4", "p-8");
    expect(result).toBe("p-8");
  });

  it("resolves conflicting Tailwind text-color classes", () => {
    const result = cn("text-red-500", "text-blue-500");
    expect(result).toBe("text-blue-500");
  });

  it("resolves conflicting Tailwind background classes", () => {
    const result = cn("bg-red-100", "bg-green-200");
    expect(result).toBe("bg-green-200");
  });

  it("handles array input", () => {
    const result = cn(["foo", "bar"]);
    expect(result).toBe("foo bar");
  });

  it("handles mixed conflicts and non-conflicts", () => {
    const result = cn("px-4 py-2 text-sm", "px-8 font-bold");
    expect(result).toBe("py-2 text-sm px-8 font-bold");
  });

  it("returns empty string for no inputs", () => {
    const result = cn();
    expect(result).toBe("");
  });
});
