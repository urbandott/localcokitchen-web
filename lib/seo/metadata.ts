import type { Metadata } from "next";
import { getPublicEnv } from "@/lib/env";

type SeoInput = {
  title: string;
  description: string;
  path?: string;
  noIndex?: boolean;
};

export function siteUrl(path = "/"): URL {
  const { NEXT_PUBLIC_SITE_URL } = getPublicEnv();
  return new URL(path, NEXT_PUBLIC_SITE_URL);
}

export function createMetadata({
  title,
  description,
  path = "/",
  noIndex = false,
}: SeoInput): Metadata {
  const url = siteUrl(path);
  const fullTitle = title.includes("LocalCoKitchen") ? title : `${title} | LocalCoKitchen`;

  return {
    metadataBase: new URL(getPublicEnv().NEXT_PUBLIC_SITE_URL),
    title: fullTitle,
    description,
    alternates: { canonical: url },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: "LocalCoKitchen",
      type: "website",
      images: [{ url: "/images/logo.png", width: 1200, height: 1200, alt: "LocalCoKitchen" }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: ["/images/logo.png"],
    },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "LocalCoKitchen",
    url: siteUrl("/").toString(),
    logo: siteUrl("/images/logo.png").toString(),
    contactPoint: {
      "@type": "ContactPoint",
      email: "info@localcokitchen.com",
      contactType: "customer support",
    },
  };
}
