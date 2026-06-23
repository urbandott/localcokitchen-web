import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "@/lib/security/safe-path";

describe("safe redirects", () => {
  it("allows local paths and rejects open redirects", () => {
    expect(safeRedirectPath("/admin/?tab=cooks")).toBe("/admin/?tab=cooks");
    expect(safeRedirectPath("//evil.example")).toBe("/");
    expect(safeRedirectPath("https://evil.example")).toBe("/");
  });
});
