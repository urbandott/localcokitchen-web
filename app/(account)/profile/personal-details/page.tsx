import Link from "next/link";
import type { Metadata } from "next";
import { ProfileDetailsForm } from "@/features/profile/profile-details-form";
import { getAccountProfile } from "@/features/profile/profile-data";
import { requireUser } from "@/lib/auth/session";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Personal details",
  description: "Manage your LocalCoKitchen account profile.",
  path: "/profile/personal-details/",
  noIndex: true,
});

export default async function PersonalDetailsPage() {
  const user = await requireUser("/profile/personal-details/");
  const profile = await getAccountProfile(user.id);

  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Account profile</p>
        <h1>Personal details</h1>
        <p className="lede">Update the name and profile photo associated with your account.</p>
      </section>
      <section className="next-section" aria-labelledby="profile-details-title">
        <div>
          <Link className="secondary-action compact-action" href="/profile/">
            Back to profile
          </Link>
        </div>
        <h2 id="profile-details-title">Your information</h2>
        {profile ? (
          <ProfileDetailsForm profile={profile} />
        ) : (
          <p className="next-alert" role="alert">
            Your profile could not be loaded. Refresh the page and try again.
          </p>
        )}
      </section>
    </div>
  );
}
