import type { Metadata } from "next";
import { MenuBrowser } from "@/features/menu/menu-browser";
import { getCustomerMenuItems } from "@/features/menu/menu-data";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Available Menu",
  description: "Browse active LocalCoKitchen menu items from approved public kitchens.",
  path: "/menu/",
});

export default async function MenuPage() {
  const { items, error } = await getCustomerMenuItems();
  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">Menu</p>
        <h1>Items currently available</h1>
        <p className="lede">
          Search, filter, view cook details, and build a cart with items from multiple cooks.
        </p>
      </section>
      <MenuBrowser items={items} error={error} />
    </div>
  );
}
