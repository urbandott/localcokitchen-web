import { describe, expect, it } from "vitest";
import { parseAccountIntent, postSignInDestination } from "@/features/auth/account-intent";

describe("account intent and sign-in destinations", () => {
  it("accepts only the cook intent value", () => {
    expect(parseAccountIntent("cook")).toBe("cook");
    expect(parseAccountIntent("admin")).toBe("customer");
    expect(parseAccountIntent("//evil.example")).toBe("customer");
    expect(parseAccountIntent(undefined)).toBe("customer");
  });

  it("sends customers home and cooks to My Kitchen", () => {
    expect(
      postSignInDestination({
        hasCookWorkspace: false,
        isAdmin: false,
        requestedAdmin: false,
      }),
    ).toBe("/");
    expect(
      postSignInDestination({
        hasCookWorkspace: true,
        isAdmin: false,
        requestedAdmin: false,
      }),
    ).toBe("/my-kitchen/");
  });

  it("allows the explicit admin flow only for verified admins", () => {
    expect(
      postSignInDestination({
        hasCookWorkspace: false,
        isAdmin: true,
        requestedAdmin: true,
      }),
    ).toBe("/admin/");
    expect(
      postSignInDestination({
        hasCookWorkspace: false,
        isAdmin: false,
        requestedAdmin: true,
      }),
    ).toBe("/");
  });
});
