import Link from "next/link";
import type { Metadata } from "next";
import { getKitchenDashboard } from "@/features/kitchen/kitchen-data";
import { requireUser } from "@/lib/auth/session";
import { createMetadata } from "@/lib/seo/metadata";
import { formatCurrency } from "@/lib/utils/format";

export const metadata: Metadata = createMetadata({
  title: "My Kitchen",
  description: "Manage your LocalCoKitchen cook dashboard.",
  path: "/my-shop/",
  noIndex: true,
});

export default async function MyShopPage() {
  const user = await requireUser("/my-shop/");
  const { application, profile, menuItems, error } = await getKitchenDashboard(user.id);

  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Cook dashboard</p>
        <h1>My Kitchen</h1>
        <p className="lede">
          Manage application status, public kitchen visibility, and menu items.
        </p>
      </section>
      {error ? <p className="next-alert">{error}</p> : null}
      {profile?.moderator_disabled_at ? (
        <p className="next-alert">
          The moderator has disabled this kitchen. Please reach out to us at info@localcokitchen.com
          for more information.
        </p>
      ) : null}
      <section className="next-card-grid">
        <article className="next-card">
          <h2>Application</h2>
          <p>Status: {application?.status ?? "Not submitted"}</p>
          <p className="next-muted">
            Cook application editing remains backed by Supabase RLS and will reject unauthorized
            changes.
          </p>
        </article>
        <article className="next-card">
          <h2>Public profile</h2>
          <p>{profile?.display_name ?? "No public profile yet"}</p>
          <p>Kitchen live: {profile?.is_public ? "Yes" : "No"}</p>
        </article>
        <article className="next-card">
          <h2>Menu items</h2>
          <p>{menuItems.length} total items</p>
          <Link className="secondary-action compact-action" href="/menu/">
            View public menu
          </Link>
        </article>
      </section>
      <section className="next-section">
        <h2>Menu inventory</h2>
        {menuItems.length === 0 ? <p className="empty-state">No menu items yet.</p> : null}
        {menuItems.map((item) => (
          <article className="next-card" key={item.id}>
            <h3>{item.name}</h3>
            <p>
              {formatCurrency(item.price_cents)} · {item.quantity_available} available ·{" "}
              {item.is_active ? "Active" : "Inactive"}
            </p>
          </article>
        ))}
      </section>
    </div>
  );
}
