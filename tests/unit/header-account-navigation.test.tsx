import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getCookApplication: vi.fn(),
  getCookIntent: vi.fn(),
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
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: table === "users" ? authMocks.getCookIntent : authMocks.getCookApplication,
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
    authMocks.getCookIntent.mockResolvedValue({
      data: { cook_onboarding_started_at: null },
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

  it("does not flash the cook CTA while account status is loading", async () => {
    authMocks.getUser.mockReturnValue(new Promise(() => undefined));

    await renderNavigation();

    expect(container.querySelector('[aria-label="Checking account status"]')).not.toBeNull();
    expect(
      container.querySelector('nav[aria-label="Primary navigation"]')?.textContent,
    ).not.toContain("Become a cook");
  });

  it("hides cook-only, browse, and menu links from a customer's account menu", async () => {
    await renderNavigation();

    const accountMenu = container.querySelector('nav[aria-label="Account navigation"]');
    const primaryMenu = container.querySelector('nav[aria-label="Primary navigation"]');

    expect(container.querySelector('summary[aria-label="Open account menu"]')).not.toBeNull();
    expect(accountMenu?.textContent).toContain("My profile");
    expect(accountMenu?.textContent).toContain("Sign out");
    expect(accountMenu?.textContent).not.toContain("My kitchen");
    expect(accountMenu?.textContent).not.toContain("Browse cooks");
    expect(accountMenu?.textContent).not.toContain("Available menu");
    expect(primaryMenu?.textContent).toContain("Become a cook");
    expect(container.textContent).not.toContain("Get started");
    expect(container.textContent).not.toContain("Sign in");
  });

  it("shows My kitchen when the signed-in user has opted in as a cook", async () => {
    authMocks.getCookApplication.mockResolvedValue({
      data: { user_id: "user-id" },
      error: null,
    });

    await renderNavigation();

    const accountMenu = container.querySelector('nav[aria-label="Account navigation"]');
    const primaryMenu = container.querySelector('nav[aria-label="Primary navigation"]');

    expect(accountMenu?.textContent).toContain("My kitchen");
    expect(accountMenu?.textContent).not.toContain("Browse cooks");
    expect(accountMenu?.textContent).not.toContain("Available menu");
    expect(primaryMenu?.textContent).not.toContain("Become a cook");
  });

  it("shows My kitchen when cook onboarding was selected during signup", async () => {
    authMocks.getCookIntent.mockResolvedValue({
      data: { cook_onboarding_started_at: "2026-07-05T12:00:00.000Z" },
      error: null,
    });

    await renderNavigation();

    expect(container.textContent).toContain("My kitchen");
    expect(
      container.querySelector('nav[aria-label="Primary navigation"]')?.textContent,
    ).not.toContain("Become a cook");
  });

  it("does not show Available menu in the signed-out mobile menu", async () => {
    authMocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await renderNavigation();

    expect(
      container.querySelector('nav[aria-label="Mobile navigation"]')?.textContent,
    ).not.toContain("Available menu");
  });
});
