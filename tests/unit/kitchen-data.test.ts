import { beforeEach, describe, expect, it, vi } from "vitest";

const kitchenMocks = vi.hoisted(() => ({
  application: vi.fn(),
  identity: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    schema: (schema: string) => ({
      from: (table: string) => ({
        select: (columns: string) => {
          kitchenMocks.select(schema, table, columns);
          return {
            eq: () => ({
              maybeSingle: table === "users" ? kitchenMocks.identity : kitchenMocks.application,
            }),
          };
        },
      }),
    }),
  })),
}));

import { userHasCookWorkspace } from "@/features/kitchen/kitchen-data";

describe("cook workspace detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    kitchenMocks.identity.mockResolvedValue({
      data: { cook_onboarding_started_at: null },
      error: null,
    });
    kitchenMocks.application.mockResolvedValue({ data: null, error: null });
  });

  it("recognizes an existing cook application without an onboarding timestamp", async () => {
    kitchenMocks.application.mockResolvedValue({
      data: { user_id: "legacy-cook-id" },
      error: null,
    });

    await expect(userHasCookWorkspace("legacy-cook-id")).resolves.toBe(true);
    expect(kitchenMocks.select).toHaveBeenCalledWith(
      "lck_marketplace",
      "cook_applications",
      "user_id",
    );
  });

  it("does not give a customer a cook workspace without intent or an application", async () => {
    await expect(userHasCookWorkspace("customer-id")).resolves.toBe(false);
  });
});
