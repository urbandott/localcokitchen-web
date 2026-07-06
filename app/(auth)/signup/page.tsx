import Link from "next/link";
import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/auth-form";
import { signUpAction } from "@/features/auth/actions";
import { parseAccountIntent } from "@/features/auth/account-intent";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Create account",
  description: "Create a LocalCoKitchen account.",
  path: "/signup/",
  noIndex: true,
});

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string }>;
}) {
  const accountIntent = parseAccountIntent((await searchParams).intent);
  const isCookSignup = accountIntent === "cook";

  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">{isCookSignup ? "Cook application" : "Account"}</p>
        <h1>{isCookSignup ? "Create your cook account" : "Create account"}</h1>
        {isCookSignup ? (
          <p className="lede">
            After creating your account, continue to My Kitchen to complete your cook application.
          </p>
        ) : null}
      </section>
      <AuthForm
        action={signUpAction}
        submitLabel={isCookSignup ? "Create cook account" : "Create account"}
        hiddenFields={{ intent: accountIntent }}
        showPasswordRequirements
        fields={[
          { name: "firstName", label: "First name", type: "text", autoComplete: "given-name" },
          { name: "lastName", label: "Last name", type: "text", autoComplete: "family-name" },
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "new-password" },
        ]}
      />
      <p>
        <Link href={isCookSignup ? "/signin/?intent=cook" : "/signin/"}>
          Already have an account?
        </Link>
      </p>
    </div>
  );
}
