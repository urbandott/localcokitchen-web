import Link from "next/link";
import type { Metadata } from "next";
import { AppChrome } from "@/components/app-chrome";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Find a Meal",
  description: "Find homemade meals available from LocalCoKitchen cooks.",
  path: "/find-a-meal/",
});

export default function FindMealPage() {
  return (
    <AppChrome>
      <div className="content-page next-page-grid">
        <section className="page-hero">
          <p className="eyebrow">Find a meal</p>
          <h1>Discover food made nearby</h1>
          <p className="lede">
            Browse the live menu to see active, in-stock dishes from approved public kitchens.
          </p>
          <Link className="primary-action" href="/menu/">
            Open available menu
          </Link>
        </section>
      </div>
    </AppChrome>
  );
}
