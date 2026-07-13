import { describe, expect, it } from "vitest";
import { sanitizeInputValue } from "@/components/filtered-input";

describe("filtered input sanitizers", () => {
  it("keeps ZIP and integer fields numeric only", () => {
    expect(sanitizeInputValue("60a6b01", "digits")).toBe("60601");
    expect(sanitizeInputValue("1e5", "digits")).toBe("15");
  });

  it("keeps prices decimal-only with one dot and two decimal places", () => {
    expect(
      sanitizeInputValue("ab12.3c4.56", "decimal", {
        decimalPlaces: 2,
        maxIntegerDigits: 5,
      }),
    ).toBe("12.34");
    expect(
      sanitizeInputValue("123456.789", "decimal", {
        decimalPlaces: 2,
        maxIntegerDigits: 5,
      }),
    ).toBe("12345.78");
  });

  it("keeps phone fields to digits and phone punctuation", () => {
    expect(sanitizeInputValue("+1 (312) ABC-555-0142 ext 9", "phone")).toBe(
      "+1 (312) -555-0142  9",
    );
  });

  it("removes alphabetic characters from no-letter fields", () => {
    expect(sanitizeInputValue("16 oz bowl / 2", "noLetters")).toBe("16   / 2");
  });
});
