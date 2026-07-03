import { describe, expect, it } from "vitest";
import { createContentSecurityPolicy } from "@/lib/security/content-security-policy";

describe("content security policy", () => {
  it("uses a nonce and strict-dynamic without allowing arbitrary inline scripts", () => {
    const policy = createContentSecurityPolicy("test-nonce", false);

    expect(policy).toContain("script-src 'self' 'nonce-test-nonce' 'strict-dynamic'");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(policy).toContain("upgrade-insecure-requests");
  });

  it("allows eval only for the Next.js development runtime", () => {
    const policy = createContentSecurityPolicy("test-nonce", true);

    expect(policy).toContain("'unsafe-eval'");
    expect(policy).not.toContain("upgrade-insecure-requests");
  });
});
