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
    expect(source).not.toMatch(/\b(?:innerHTML|outerHTML|insertAdjacentHTML|eval|Function)\b/);
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
    expect(read("next.config.ts")).toMatch(/Content-Security-Policy/);
    expect(read("next.config.ts")).toMatch(/frame-ancestors 'none'/);
  });
});
