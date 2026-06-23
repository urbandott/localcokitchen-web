import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "How It Works",
  description: "Learn how LocalCoKitchen connects customers with approved independent cooks.",
  path: "/how-it-works/",
});

export default function HowItWorksPage() {
  return (
    <div className="content-page next-page-grid">
      <section className="page-hero">
        <p className="eyebrow">How it works</p>
        <h1>A simpler way to discover homemade food.</h1>
      </section>
      <section className="next-card-grid">
        <article className="next-card">
          <h2>1. Browse</h2>
          <p>Customers search active menu items from approved public kitchens.</p>
        </article>
        <article className="next-card">
          <h2>2. Review details</h2>
          <p>Customers can inspect ingredients, allergens, portions, notes, and cook profiles.</p>
        </article>
        <article className="next-card">
          <h2>3. Order safely</h2>
          <p>
            Checkout must verify item availability, cook status, pricing, and order totals on the
            server.
          </p>
        </article>
      </section>
    </div>
  );
}
