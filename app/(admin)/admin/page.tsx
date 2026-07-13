import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Admin Portal",
  description: "LocalCoKitchen admin portal.",
  path: "/admin/",
  noIndex: true,
});

export default async function AdminPage() {
  await requireAdmin();
  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Admin</p>
        <h1>Admin portal</h1>
      </section>
      <section className="next-card-grid">
        <article className="next-card">
          <h2>Cook applications</h2>
          <Link className="secondary-action compact-action" href="/admin/cook-applications/">
            Review applications
          </Link>
        </article>
        <article className="next-card">
          <h2>Cook directory</h2>
          <Link className="secondary-action compact-action" href="/admin/cooks/">
            Manage cooks
          </Link>
        </article>
        <article className="next-card">
          <h2>Orders</h2>
          <Link className="secondary-action compact-action" href="/admin/orders/">
            Review orders
          </Link>
        </article>
        <article className="next-card">
          <h2>Metrics</h2>
          <Link className="secondary-action compact-action" href="/admin/metrics/">
            View metrics
          </Link>
        </article>
        <article className="next-card">
          <h2>Audit events</h2>
          <Link className="secondary-action compact-action" href="/admin/audit/">
            Review audit log
          </Link>
        </article>
        <article className="next-card">
          <h2>Notifications</h2>
          <Link className="secondary-action compact-action" href="/admin/notifications/">
            Review delivery
          </Link>
        </article>
      </section>
    </div>
  );
}
