import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/auth-form";
import { forgotPasswordAction } from "@/features/auth/actions";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Forgot password",
  description: "Reset your LocalCoKitchen password.",
  path: "/forgot-password/",
  noIndex: true,
});

export default function ForgotPasswordPage() {
  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Account</p>
        <h1>Reset your password</h1>
      </section>
      <AuthForm
        action={forgotPasswordAction}
        submitLabel="Send reset instructions"
        fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]}
      />
    </div>
  );
}
