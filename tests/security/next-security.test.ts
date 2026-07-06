import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertNoPrivateCookField } from "@/lib/security/safe-path";

const root = path.resolve(__dirname, "../..");

function read(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("Next.js security regressions", () => {
  it("does not expose service role keys or unsafe HTML sinks in app code", () => {
    const files = ["app", "components", "features", "lib"]
      .flatMap((directory) =>
        fs
          .readdirSync(path.join(root, directory), { recursive: true })
          .map((file) => path.join(directory, String(file))),
      )
      .filter((file) => /\.(ts|tsx)$/.test(file));
    const source = files.map(read).join("\n");
    expect(source).not.toMatch(/service[_-]?role/i);
    expect(source).not.toMatch(
      /\b(?:innerHTML|outerHTML|insertAdjacentHTML)\b|\beval\s*\(|\bnew\s+Function\s*\(/,
    );
    expect(source).not.toMatch(/dangerouslySetInnerHTML/);
  });

  it("keeps private cook fields out of public menu types", () => {
    expect(assertNoPrivateCookField(["name", "cook_display_name", "cook_cuisine_type"])).toBe(true);
    expect(assertNoPrivateCookField(["legal_name"])).toBe(false);
    expect(read("features/menu/menu-data.ts")).not.toMatch(
      /legal_name|pickup_address|permit_or_certification_url|review_notes/,
    );
  });

  it("sets noindex for private route groups and secure headers in Next config", () => {
    expect(read("app/(auth)/layout.tsx")).toMatch(/index: false/);
    expect(read("app/(account)/layout.tsx")).toMatch(/index: false/);
    expect(read("app/(admin)/layout.tsx")).toMatch(/index: false/);
    expect(read("proxy.ts")).toMatch(/Content-Security-Policy/);
    expect(read("lib/security/content-security-policy.ts")).toMatch(/frame-ancestors 'none'/);
    expect(read("lib/security/content-security-policy.ts")).toMatch(/nonce-/);
    expect(read("lib/security/content-security-policy.ts")).not.toMatch(
      /script-src[^;\n]*unsafe-inline/,
    );
  });

  it("uses the protected My Kitchen route and preserves old bookmarks", () => {
    expect(read("app/(cook)/my-kitchen/page.tsx")).toMatch(/requireUser\("\/my-kitchen\/"\)/);
    expect(read("proxy.ts")).toMatch(/"\/my-kitchen"/);
    expect(read("app/robots.ts")).toMatch(/"\/my-kitchen\/"/);
    expect(read("next.config.ts")).toMatch(/source: "\/my-shop\/:path\*"/);
    expect(read("next.config.ts")).toMatch(/destination: "\/my-kitchen\/:path\*"/);
  });

  it("uses the canonical image asset for visible and browser branding", () => {
    expect(read("lib/brand.ts")).toMatch(/logo: "\/images\/logo\.svg"/);
    expect(read("components/brand-logo.tsx")).toMatch(/BRAND_ASSETS\.logo/);
    expect(read("components/site-header.tsx")).toMatch(/<BrandLogo placement="header" priority/);
    expect(read("components/site-footer.tsx")).toMatch(/<BrandLogo placement="footer"/);
    expect(read("lib/seo/metadata.ts")).toMatch(/icons: \{/);
    expect(read("lib/seo/metadata.ts")).toMatch(/BRAND_ASSETS\.logo/);
    expect(read("components/site-header.tsx")).not.toMatch(/ChefHat/);
    expect(read("components/site-footer.tsx")).not.toMatch(/ChefHat/);
  });

  it("keeps account profile updates owner-scoped and profile images private", () => {
    const migration = read(
      "supabase/migrations/20260703023857_add_customer_profile_management.sql",
    );
    const action = read("features/profile/actions.ts");

    expect(migration).toMatch(/for update\s+to authenticated/);
    expect(migration).toMatch(/auth\.uid\(\)\) = id/);
    expect(migration).toMatch(/grant update \(first_name, last_name, full_name, avatar_path\)/);
    expect(migration).toMatch(/avatar_path like id::text \|\| '\/%'/);
    expect(migration).toMatch(/public = false/);
    expect(action).toMatch(/PROFILE_IMAGE_MAX_BYTES/);
    expect(action).toMatch(/validateProfileImage/);
    expect(action).toMatch(/upsert: false/);
    expect(action).not.toMatch(/newAvatar\.name/);
  });

  it("keeps cook onboarding intent separate from cook authorization", () => {
    const migration = read("supabase/migrations/20260706002918_add_cook_onboarding_intent.sql");
    const authActions = read("features/auth/actions.ts");

    expect(migration).toMatch(/Cook onboarding intent is a navigation preference/);
    expect(migration).toMatch(/grant update \(cook_onboarding_started_at\)/);
    expect(migration).toMatch(
      /avatar_path = coalesce\(excluded\.avatar_path, lck_identity\.users\.avatar_path\)/,
    );
    expect(authActions).toMatch(/postSignInDestination/);
    expect(authActions).toMatch(/cook_onboarding_started_at/);
    expect(authActions).not.toMatch(/user_metadata.*(?:role|admin|approved)/i);
  });
});
