import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getCookApplication: vi.fn(),
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("@/lib/supabase/config", () => ({
  getSupabaseBrowserConfig: () => ({
    url: "https://example.supabase.co",
    publishableKey: "sb_publishable_test",
  }),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    auth: {
      getUser: authMocks.getUser,
      onAuthStateChange: authMocks.onAuthStateChange,
    },
    schema: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: authMocks.getCookApplication,
          }),
        }),
      }),
    }),
  }),
}));

vi.mock("@/features/auth/actions", () => ({
  signOutAction: vi.fn(),
}));

import { HeaderAccountNavigation } from "@/components/header-account-navigation";

describe("header account navigation", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    authMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-id" } },
      error: null,
    });
    authMocks.getCookApplication.mockResolvedValue({
      data: null,
      error: null,
    });
    authMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: authMocks.unsubscribe } },
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  async function renderNavigation() {
    await act(async () => {
      root.render(<HeaderAccountNavigation />);
    });
    await act(async () => {
      await Promise.resolve();
    });
  }

  it("hides cook-only and browse links from a customer's account menu", async () => {
    await renderNavigation();

    expect(container.querySelector('summary[aria-label="Open account menu"]')).not.toBeNull();
    expect(container.textContent).toContain("My profile");
    expect(container.textContent).toContain("Available menu");
    expect(container.textContent).toContain("Sign out");
    expect(container.textContent).not.toContain("My kitchen");
    expect(container.textContent).not.toContain("Browse cooks");
    expect(container.textContent).not.toContain("Get started");
    expect(container.textContent).not.toContain("Sign in");
  });

  it("shows My kitchen when the signed-in user has opted in as a cook", async () => {
    authMocks.getCookApplication.mockResolvedValue({
      data: { id: "application-id" },
      error: null,
    });

    await renderNavigation();

    expect(container.textContent).toContain("My kitchen");
    expect(container.textContent).not.toContain("Browse cooks");
  });
});
