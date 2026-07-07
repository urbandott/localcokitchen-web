import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const kitchenPageMocks = vi.hoisted(() => ({
  getDashboard: vi.fn(),
  hasWorkspace: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: kitchenPageMocks.redirect,
}));

vi.mock("@/lib/auth/session", () => ({
  requireUser: vi.fn().mockResolvedValue({
    id: "legacy-cook-id",
    email: "cook@example.com",
  }),
}));

vi.mock("@/features/kitchen/kitchen-data", () => ({
  getKitchenDashboard: kitchenPageMocks.getDashboard,
  userHasCookWorkspace: kitchenPageMocks.hasWorkspace,
}));

vi.mock("@/features/kitchen/cook-application-form", () => ({
  CookApplicationForm: () => <form aria-label="Cook application form" />,
}));

import MyKitchenPage from "@/app/(cook)/my-kitchen/page";

describe("My Kitchen access", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    kitchenPageMocks.hasWorkspace.mockResolvedValue(true);
    kitchenPageMocks.getDashboard.mockResolvedValue({
      application: {
        user_id: "legacy-cook-id",
        status: "approved",
      },
      profile: null,
      menuItems: [],
      error: null,
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("allows an existing cook application into the kitchen dashboard", async () => {
    const page = await MyKitchenPage();

    await act(async () => {
      root.render(page);
    });

    expect(kitchenPageMocks.redirect).not.toHaveBeenCalled();
    expect(container.textContent).toContain("My Kitchen");
    expect(container.textContent).toContain("Status: Approved");
  });

  it("shows the application form when onboarding has started but no application exists", async () => {
    kitchenPageMocks.getDashboard.mockResolvedValue({
      application: null,
      profile: null,
      menuItems: [],
      error: null,
    });

    const page = await MyKitchenPage();

    await act(async () => {
      root.render(page);
    });

    expect(container.textContent).toContain("Status: Not submitted");
    expect(container.querySelector("form[aria-label='Cook application form']")).not.toBeNull();
  });

  it("shows rejected review notes and allows resubmission", async () => {
    kitchenPageMocks.getDashboard.mockResolvedValue({
      application: {
        user_id: "legacy-cook-id",
        status: "rejected",
        review_notes: "Please upload a clearer ID photo.",
      },
      profile: null,
      menuItems: [],
      error: null,
    });

    const page = await MyKitchenPage();

    await act(async () => {
      root.render(page);
    });

    expect(container.textContent).toContain("Status: Needs changes");
    expect(container.textContent).toContain("Please upload a clearer ID photo.");
    expect(container.querySelector("form[aria-label='Cook application form']")).not.toBeNull();
  });
});
