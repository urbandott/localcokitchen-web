import Link from "next/link";
import type { Metadata } from "next";
import { signOutAction } from "@/features/auth/actions";
import { requireUser } from "@/lib/auth/session";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Profile",
  description: "Manage your LocalCoKitchen profile.",
  path: "/profile/",
  noIndex: true,
});

export default async function ProfilePage() {
  const user = await requireUser("/profile/");
  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Account</p>
        <h1>Your profile</h1>
        <p className="lede">{user.email}</p>
      </section>
      <section className="next-card-grid">
        <article className="next-card">
          <h2>My kitchen</h2>
          <p>Apply as a cook, manage your public profile, menu, and pickup windows.</p>
          <Link className="secondary-action compact-action" href="/my-shop/">
            Open kitchen dashboard
          </Link>
        </article>
        <article className="next-card">
          <h2>Account security</h2>
          <p>Use a strong password and keep your email account secure.</p>
          <Link className="secondary-action compact-action" href="/reset-password/">
            Reset password
          </Link>
        </article>
        <article className="next-card">
          <h2>Sign out</h2>
          <form action={signOutAction}>
            <button className="primary-action compact-action" type="submit">
              Sign out
            </button>
          </form>
        </article>
      </section>
    </div>
  );
}
