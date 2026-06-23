import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/auth-form";
import { resetPasswordAction } from "@/features/auth/actions";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Reset password",
  description: "Set a new LocalCoKitchen password.",
  path: "/reset-password/",
  noIndex: true,
});

export default function ResetPasswordPage() {
  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Account</p>
        <h1>Set a new password</h1>
      </section>
      <AuthForm
        action={resetPasswordAction}
        submitLabel="Update password"
        fields={[
          {
            name: "password",
            label: "New password",
            type: "password",
            autoComplete: "new-password",
          },
          {
            name: "confirmPassword",
            label: "Confirm password",
            type: "password",
            autoComplete: "new-password",
          },
        ]}
      />
    </div>
  );
}
