import Link from "next/link";
import type { Metadata } from "next";
import { listAdminCooks } from "@/features/admin/admin-data";
import { requireAdmin } from "@/lib/auth/session";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Cook Applications",
  description: "Review LocalCoKitchen cook applications.",
  path: "/admin/cook-applications/",
  noIndex: true,
});

export default async function AdminApplicationsPage() {
  await requireAdmin();
  const { cooks, error } = await listAdminCooks();
  const applications = cooks.filter((cook) => cook.application_status === "submitted");
  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Admin</p>
        <h1>Cook applications</h1>
      </section>
      {error ? <p className="next-alert">{error}</p> : null}
      {applications.length === 0 ? (
        <p className="empty-state">No submitted cook applications need review.</p>
      ) : null}
      <section className="next-section">
        {applications.map((cook) => (
          <article className="next-card" key={cook.cook_id}>
            <h2>{cook.legal_name ?? cook.full_name ?? cook.email}</h2>
            <p>
              {cook.email} · {cook.pickup_zip_code}
            </p>
            <Link className="secondary-action compact-action" href="/admin/cooks/">
              Open cook directory
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
}
