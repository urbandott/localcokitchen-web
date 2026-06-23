import type { Metadata } from "next";
import { getAdminMetrics } from "@/features/admin/admin-data";
import { requireAdmin } from "@/lib/auth/session";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Admin Metrics",
  description: "LocalCoKitchen admin metrics.",
  path: "/admin/metrics/",
  noIndex: true,
});

export default async function AdminMetricsPage() {
  await requireAdmin();
  const { metrics, error } = await getAdminMetrics();
  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Admin</p>
        <h1>Metrics</h1>
      </section>
      {error ? <p className="next-alert">{error}</p> : null}
      <section className="next-card-grid">
        {metrics
          ? Object.entries(metrics).map(([key, value]) => (
              <article className="next-card" key={key}>
                <h2>{key.replaceAll("_", " ")}</h2>
                <p>{String(value)}</p>
              </article>
            ))
          : null}
      </section>
    </div>
  );
}
