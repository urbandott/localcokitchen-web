"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { signOutAction } from "@/features/auth/actions";
import {
  accountNavigation,
  cookAccountNavigation,
  mobileUtilityNavigation,
  primaryNavigation,
} from "@/lib/navigation/site-navigation";
import { createClient } from "@/lib/supabase/browser";
import { getSupabaseBrowserConfig } from "@/lib/supabase/config";

type AuthStatus = "loading" | "signed-in" | "signed-out";

const menuLinkClass =
  "rounded-xl px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary";
const cookCtaHref = "/#cook-cta";

function PrimaryNavigation({ showCookCta }: { showCookCta: boolean }) {
  const navigation = showCookCta
    ? primaryNavigation
    : primaryNavigation.filter((link) => link.href !== cookCtaHref);

  return (
    <nav
      className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex"
      aria-label="Primary navigation"
    >
      {navigation.map((link) => (
        <Link className="transition-colors hover:text-foreground" href={link.href} key={link.href}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function HeaderAccountNavigation() {
  const supabaseConfigured = Boolean(getSupabaseBrowserConfig());
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() =>
    supabaseConfigured ? "loading" : "signed-out",
  );
  const [hasCookApplication, setHasCookApplication] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const client = createClient();
    if (!client) return;
    const authenticatedClient = client;

    let active = true;
    let authEventReceived = false;
    let accountRequest = 0;

    async function updateAccountState(userId?: string) {
      const request = ++accountRequest;
      if (!userId) {
        if (active) {
          setHasCookApplication(false);
          setAuthStatus("signed-out");
        }
        return;
      }

      const [identity, application] = await Promise.all([
        authenticatedClient
          .schema("lck_identity")
          .from("users")
          .select("cook_onboarding_started_at")
          .eq("id", userId)
          .maybeSingle(),
        authenticatedClient
          .schema("lck_marketplace")
          .from("cook_applications")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle(),
      ]);

      if (active && request === accountRequest) {
        setHasCookApplication(
          Boolean(
            (!identity.error && identity.data?.cook_onboarding_started_at) ||
            (!application.error && application.data),
          ),
        );
        setAuthStatus("signed-in");
      }
    }

    const {
      data: { subscription },
    } = authenticatedClient.auth.onAuthStateChange((event, session) => {
      if (!active || event === "INITIAL_SESSION") return;
      authEventReceived = true;
      void updateAccountState(session?.user.id);
    });

    void authenticatedClient.auth.getUser().then(({ data, error }) => {
      if (active && !authEventReceived) {
        void updateAccountState(!error ? data.user?.id : undefined);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabaseConfigured]);

  if (authStatus === "loading") {
    return (
      <>
        <PrimaryNavigation showCookCta={false} />
        <div className="flex items-center gap-2">
          <div
            className="h-10 w-32 animate-pulse rounded-full bg-secondary sm:w-44"
            role="status"
            aria-label="Checking account status"
          />
        </div>
      </>
    );
  }

  if (authStatus === "signed-in") {
    const navigation = hasCookApplication
      ? accountNavigation.flatMap((link, index) =>
          index === 1 ? [cookAccountNavigation, link] : [link],
        )
      : accountNavigation;

    return (
      <>
        <PrimaryNavigation showCookCta={!hasCookApplication} />
        <div className="flex items-center gap-2">
          <details className="group relative">
            <summary
              aria-label="Open account menu"
              className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full border border-border bg-background transition-colors hover:bg-secondary [&::-webkit-details-marker]:hidden"
            >
              <Menu className="h-5 w-5" />
            </summary>
            <nav
              aria-label="Account navigation"
              className="absolute right-0 top-12 z-50 grid w-64 gap-1 rounded-2xl border border-border bg-background p-2 shadow-card"
            >
              {navigation.map((link) => (
                <Link className={menuLinkClass} href={link.href} key={link.href}>
                  {link.label}
                </Link>
              ))}
              <form action={signOutAction} className="mt-1 border-t border-border pt-1">
                <button
                  className={`${menuLinkClass} w-full cursor-pointer border-0 bg-transparent text-left`}
                  type="submit"
                >
                  Sign out
                </button>
              </form>
            </nav>
          </details>
        </div>
      </>
    );
  }

  return (
    <>
      <PrimaryNavigation showCookCta />
      <div className="flex items-center gap-2">
        <Link
          href="/signin/"
          className="hidden h-10 items-center rounded-full px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary sm:inline-flex"
        >
          Sign in
        </Link>
        <Link
          href="/signup/"
          className="inline-flex h-10 items-center rounded-full bg-foreground px-4 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
        >
          Get started
        </Link>
        <details className="group relative md:hidden">
          <summary
            aria-label="Open menu"
            className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full border border-border [&::-webkit-details-marker]:hidden"
          >
            <Menu className="h-5 w-5" />
          </summary>
          <nav
            aria-label="Mobile navigation"
            className="absolute right-0 top-12 z-50 grid w-64 gap-1 rounded-2xl border border-border bg-background p-2 shadow-card"
          >
            {[...primaryNavigation, ...mobileUtilityNavigation].map((link) => (
              <Link className={menuLinkClass} href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        </details>
      </div>
    </>
  );
}
