import type { Metadata } from "next";
import { setKitchenDisabledAction } from "@/features/admin/actions";
import { listAdminCooks } from "@/features/admin/admin-data";
import { requireAdmin } from "@/lib/auth/session";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Admin Cook Directory",
  description: "Manage LocalCoKitchen cooks.",
  path: "/admin/cooks/",
  noIndex: true,
});

export default async function AdminCooksPage() {
  await requireAdmin();
  const { cooks, error } = await listAdminCooks();
  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Admin</p>
        <h1>Cook directory</h1>
      </section>
      {error ? <p className="next-alert">{error}</p> : null}
      <section className="next-section">
        {cooks.map((cook) => (
          <article className="next-card" key={cook.cook_id}>
            <h2
              className="text-truncate"
              title={cook.display_name ?? cook.full_name ?? cook.email ?? undefined}
            >
              {cook.display_name ?? cook.full_name ?? cook.email ?? "Cook"}
            </h2>
            <p>
              Status: {cook.application_status} · Live: {cook.is_live_kitchen ? "Yes" : "No"} · Menu
              items: {cook.active_menu_item_count}
            </p>
            <form action={setKitchenDisabledAction}>
              <input type="hidden" name="cookId" value={cook.cook_id} />
              <input
                type="hidden"
                name="disabled"
                value={cook.moderator_disabled_at ? "false" : "true"}
              />
              <button className="primary-action compact-action" type="submit">
                {cook.moderator_disabled_at ? "Re-enable kitchen" : "Disable kitchen"}
              </button>
            </form>
          </article>
        ))}
      </section>
    </div>
  );
}
