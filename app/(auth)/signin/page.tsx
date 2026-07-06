import Link from "next/link";
import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/auth-form";
import { signInAction } from "@/features/auth/actions";
import { parseAccountIntent } from "@/features/auth/account-intent";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Sign in",
  description: "Sign in to LocalCoKitchen.",
  path: "/signin/",
  noIndex: true,
});

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string; next?: string }>;
}) {
  const params = await searchParams;
  const accountIntent = parseAccountIntent(params.intent);
  const isCookSignIn = accountIntent === "cook";

  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">{isCookSignIn ? "Cook account" : "Account"}</p>
        <h1>{isCookSignIn ? "Sign in to your kitchen" : "Sign in"}</h1>
      </section>
      <AuthForm
        action={signInAction}
        submitLabel="Sign in"
        hiddenFields={{
          intent: accountIntent,
          ...(params.next === "/admin/" ? { next: "/admin/" } : {}),
        }}
        fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          {
            name: "password",
            label: "Password",
            type: "password",
            autoComplete: "current-password",
          },
        ]}
      />
      <p>
        <Link href="/forgot-password/">Forgot password?</Link> ·{" "}
        <Link href={isCookSignIn ? "/signup/?intent=cook" : "/signup/"}>Create account</Link>
      </p>
    </div>
  );
}
