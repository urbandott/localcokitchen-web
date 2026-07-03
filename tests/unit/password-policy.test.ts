import { describe, expect, it } from "vitest";
import {
  evaluatePasswordRequirements,
  meetsPasswordRequirements,
  PASSWORD_MAX_LENGTH,
} from "@/features/auth/password-policy";

describe("signup password policy", () => {
  it("accepts a password that meets every requirement", () => {
    expect(evaluatePasswordRequirements("StrongPass1!")).toEqual({
      length: true,
      lowercase: true,
      uppercase: true,
      digit: true,
      symbol: true,
    });
    expect(meetsPasswordRequirements("StrongPass1!")).toBe(true);
  });

  it.each([
    ["Short1!", "length"],
    ["STRONGPASS1!", "lowercase"],
    ["strongpass1!", "uppercase"],
    ["StrongPass!", "digit"],
    ["StrongPass1", "symbol"],
  ])("rejects a password missing the %s requirement", (password, failedRequirement) => {
    const results = evaluatePasswordRequirements(password);

    expect(results[failedRequirement as keyof typeof results]).toBe(false);
    expect(meetsPasswordRequirements(password)).toBe(false);
  });

  it("rejects passwords over the abuse-resistant maximum", () => {
    const password = `Aa1!${"x".repeat(PASSWORD_MAX_LENGTH)}`;

    expect(meetsPasswordRequirements(password)).toBe(false);
  });
});
