import Link from "next/link";
import type { Metadata } from "next";
import { userHasCookWorkspace } from "@/features/kitchen/kitchen-data";
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
  const hasCookWorkspace = await userHasCookWorkspace(user.id);

  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Account</p>
        <h1>Your profile</h1>
        <p className="lede">{user.email}</p>
      </section>
      <section className="next-card-grid profile-card-grid">
        <article className="next-card">
          <h2>Personal details</h2>
          <p>Update your name and profile photo.</p>
          <Link className="secondary-action compact-action" href="/profile/personal-details/">
            Manage profile
          </Link>
        </article>
        {hasCookWorkspace ? (
          <article className="next-card">
            <h2>My kitchen</h2>
            <p>Manage your cook application, public profile, menu, and pickup windows.</p>
            <Link className="secondary-action compact-action" href="/my-kitchen/">
              Open kitchen dashboard
            </Link>
          </article>
        ) : null}
        <article className="next-card">
          <h2>Account security</h2>
          <p>Use a strong password and keep your email account secure.</p>
          <Link className="secondary-action compact-action" href="/reset-password/">
            Reset password
          </Link>
        </article>
      </section>
    </div>
  );
}
