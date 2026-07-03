import type { Metadata } from "next";
import { BRAND_ASSETS, BRAND_NAME } from "@/lib/brand";
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
  const fullTitle = title.includes(BRAND_NAME) ? title : `${title} | ${BRAND_NAME}`;

  return {
    metadataBase: new URL(getPublicEnv().NEXT_PUBLIC_SITE_URL),
    title: fullTitle,
    description,
    applicationName: BRAND_NAME,
    icons: {
      icon: [{ url: BRAND_ASSETS.logo, type: "image/svg+xml" }],
      shortcut: [BRAND_ASSETS.logo],
      apple: [{ url: BRAND_ASSETS.socialLogo, type: "image/png" }],
    },
    alternates: { canonical: url },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: BRAND_NAME,
      type: "website",
      images: [{ url: BRAND_ASSETS.socialLogo, width: 1200, height: 1200, alt: BRAND_NAME }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [BRAND_ASSETS.socialLogo],
    },
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND_NAME,
    url: siteUrl("/").toString(),
    logo: siteUrl(BRAND_ASSETS.socialLogo).toString(),
    contactPoint: {
      "@type": "ContactPoint",
      email: "info@localcokitchen.com",
      contactType: "customer support",
    },
  };
}
