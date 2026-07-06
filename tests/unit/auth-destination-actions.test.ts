import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  application: vi.fn(),
  getUser: vi.fn(),
  identity: vi.fn(),
  isAdmin: vi.fn(),
  markCookIntent: vi.fn(),
  redirect: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  updateIdentity: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: authMocks.redirect,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: authMocks.getUser,
      signInWithPassword: authMocks.signIn,
      signUp: authMocks.signUp,
    },
    schema: (schema: string) => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: schema === "lck_identity" ? authMocks.identity : authMocks.application,
          }),
        }),
        update: authMocks.updateIdentity,
      }),
      rpc: authMocks.isAdmin,
    }),
  })),
}));

import { signInAction, signUpAction, startCookOnboardingAction } from "@/features/auth/actions";

const initialState = { ok: false, message: "" };

function signInData(values: { intent?: string; next?: string } = {}) {
  const data = new FormData();
  data.set("email", "asha@example.com");
  data.set("password", "StrongPass1!");
  if (values.intent) data.set("intent", values.intent);
  if (values.next) data.set("next", values.next);
  return data;
}

function signUpData(intent: "cook" | "customer") {
  const data = signInData({ intent });
  data.set("firstName", "Asha");
  data.set("lastName", "Patel");
  return data;
}

describe("auth destination actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.redirect.mockImplementation((path: string) => {
      throw new Error(`REDIRECT:${path}`);
    });
    authMocks.signIn.mockResolvedValue({
      data: { user: { id: "user-id" } },
      error: null,
    });
    authMocks.getUser.mockResolvedValue({
      data: { user: { id: "user-id" } },
      error: null,
    });
    authMocks.signUp.mockResolvedValue({
      data: { user: { id: "user-id" }, session: null },
      error: null,
    });
    authMocks.markCookIntent.mockResolvedValue({ data: { id: "user-id" }, error: null });
    authMocks.updateIdentity.mockImplementation(() => ({
      eq: () => ({
        select: () => ({
          single: authMocks.markCookIntent,
        }),
      }),
    }));
    authMocks.identity.mockResolvedValue({
      data: { cook_onboarding_started_at: null },
      error: null,
    });
    authMocks.application.mockResolvedValue({ data: null, error: null });
    authMocks.isAdmin.mockResolvedValue({ data: false, error: null });
  });

  it("always redirects a standard customer sign-in home", async () => {
    await expect(signInAction(initialState, signInData({ next: "/profile/" }))).rejects.toThrow(
      "REDIRECT:/",
    );
    expect(authMocks.markCookIntent).not.toHaveBeenCalled();
  });

  it("redirects established cooks to My Kitchen", async () => {
    authMocks.application.mockResolvedValue({ data: { user_id: "user-id" }, error: null });

    await expect(signInAction(initialState, signInData())).rejects.toThrow("REDIRECT:/my-kitchen/");
  });

  it("persists explicit cook intent and redirects to My Kitchen", async () => {
    await expect(signInAction(initialState, signInData({ intent: "cook" }))).rejects.toThrow(
      "REDIRECT:/my-kitchen/",
    );
    expect(authMocks.updateIdentity).toHaveBeenCalledWith({
      cook_onboarding_started_at: expect.any(String),
    });
    expect(authMocks.markCookIntent).toHaveBeenCalledOnce();
  });

  it("preserves the verified admin sign-in destination", async () => {
    authMocks.isAdmin.mockResolvedValue({ data: true, error: null });

    await expect(signInAction(initialState, signInData({ next: "/admin/" }))).rejects.toThrow(
      "REDIRECT:/admin/",
    );
  });

  it("stores cook intent during signup without changing generic confirmation messaging", async () => {
    const result = await signUpAction(initialState, signUpData("cook"));

    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/check your inbox/i);
    expect(authMocks.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: {
          data: expect.objectContaining({ account_intent: "cook" }),
        },
      }),
    );
  });

  it("sends signed-out cook applicants to the cook signup flow", async () => {
    authMocks.getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(startCookOnboardingAction()).rejects.toThrow("REDIRECT:/signup/?intent=cook");
    expect(authMocks.updateIdentity).not.toHaveBeenCalled();
  });

  it("marks a signed-in customer and sends them directly to My Kitchen", async () => {
    await expect(startCookOnboardingAction()).rejects.toThrow("REDIRECT:/my-kitchen/");

    expect(authMocks.updateIdentity).toHaveBeenCalledWith({
      cook_onboarding_started_at: expect.any(String),
    });
    expect(authMocks.markCookIntent).toHaveBeenCalledOnce();
  });

  it("keeps cook onboarding idempotent for an existing cook workspace", async () => {
    authMocks.identity.mockResolvedValue({
      data: { cook_onboarding_started_at: "2026-07-05T12:00:00.000Z" },
      error: null,
    });

    await expect(startCookOnboardingAction()).rejects.toThrow("REDIRECT:/my-kitchen/");
    expect(authMocks.updateIdentity).not.toHaveBeenCalled();
  });
});
