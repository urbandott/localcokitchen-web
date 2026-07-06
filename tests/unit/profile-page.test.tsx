import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const profileMocks = vi.hoisted(() => ({
  hasCookApplication: vi.fn(),
}));

vi.mock("@/features/kitchen/kitchen-data", () => ({
  userHasCookWorkspace: profileMocks.hasCookApplication,
}));

vi.mock("@/lib/auth/session", () => ({
  requireUser: vi.fn().mockResolvedValue({
    id: "customer-id",
    email: "customer@example.com",
  }),
}));

import ProfilePage from "@/app/(account)/profile/page";

describe("profile page cook navigation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    profileMocks.hasCookApplication.mockResolvedValue(false);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it("does not show My kitchen to a customer without a cook application", async () => {
    const page = await ProfilePage();

    await act(async () => {
      root.render(page);
    });

    expect(container.textContent).not.toContain("My kitchen");
    expect(container.textContent).not.toContain("Open kitchen dashboard");
    expect(container.textContent).not.toContain("Sign out");
    expect(container.textContent).toContain("Personal details");
    expect(container.textContent).toContain("Manage profile");
    expect(container.querySelector('a[href^="/profile/personal-details"]')).not.toBeNull();
  });

  it("shows My kitchen after the user opts in as a cook", async () => {
    profileMocks.hasCookApplication.mockResolvedValue(true);
    const page = await ProfilePage();

    await act(async () => {
      root.render(page);
    });

    expect(container.textContent).toContain("My kitchen");
    expect(container.textContent).toContain("Open kitchen dashboard");
  });
});
