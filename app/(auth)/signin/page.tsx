import Link from "next/link";
import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/auth-form";
import { signInAction } from "@/features/auth/actions";
import { createMetadata } from "@/lib/seo/metadata";
import { safeRedirectPath } from "@/lib/security/safe-path";

export const metadata: Metadata = createMetadata({
  title: "Sign in",
  description: "Sign in to LocalCoKitchen.",
  path: "/signin/",
  noIndex: true,
});

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Account</p>
        <h1>Sign in</h1>
      </section>
      <AuthForm
        action={signInAction}
        submitLabel="Sign in"
        hiddenFields={{ next: safeRedirectPath(params.next, "/profile/") }}
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
        <Link href="/signup/">Create account</Link>
      </p>
    </div>
  );
}
