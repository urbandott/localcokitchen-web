import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Homemade meals from local cooks",
  description:
    "LocalCoKitchen connects customers with trusted independent cooks for homemade meals and scheduled local pickups.",
});

export default function HomePage() {
  return (
    <div className="content-page next-page-grid">
      <section className="home-hero">
        <div>
          <p className="eyebrow">Local homemade food</p>
          <h1>Great food made closer to home.</h1>
          <p className="lede">
            Browse available dishes from approved LocalCoKitchen cooks and discover meals prepared
            by people in your community.
          </p>
          <div className="button-row">
            <Link className="primary-action" href="/menu/">
              Browse menu
            </Link>
            <Link className="secondary-action" href="/sell-your-food/">
              Become a cook
            </Link>
          </div>
        </div>
        <Image
          src="/images/home-story-feature.jpg"
          width={900}
          height={720}
          alt="A home cook preparing a shared meal"
          priority
        />
      </section>
      <section className="next-card-grid" aria-label="How LocalCoKitchen works">
        <article className="next-card">
          <h2>Find local dishes</h2>
          <p>Search and filter active menu items from approved, public kitchens.</p>
        </article>
        <article className="next-card">
          <h2>Know the cook</h2>
          <p>View public cook profiles, cuisine types, ratings, notes, and menu counts.</p>
        </article>
        <article className="next-card">
          <h2>Pickup with confidence</h2>
          <p>
            Cook visibility and item availability are revalidated by the backend before checkout.
          </p>
        </article>
      </section>
    </div>
  );
}
