import type { Metadata } from "next";
import { ReferenceSearchPage } from "@/features/search/reference-search-page";
import { createMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createMetadata({
  title: "Browse home cooks near you",
  description:
    "Search verified local home cooks by cuisine, dish, rating, and distance. Schedule pickup for fresh homemade food.",
  path: "/search/",
});

export default function SearchPage() {
  return <ReferenceSearchPage />;
}
