import Link from "next/link";
import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/auth-form";
import { signUpAction } from "@/features/auth/actions";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Create account",
  description: "Create a LocalCoKitchen account.",
  path: "/signup/",
  noIndex: true,
});

export default function SignUpPage() {
  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Account</p>
        <h1>Create account</h1>
      </section>
      <AuthForm
        action={signUpAction}
        submitLabel="Create account"
        showPasswordRequirements
        fields={[
          { name: "firstName", label: "First name", type: "text", autoComplete: "given-name" },
          { name: "lastName", label: "Last name", type: "text", autoComplete: "family-name" },
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "new-password" },
        ]}
      />
      <p>
        <Link href="/signin/">Already have an account?</Link>
      </p>
    </div>
  );
}
