import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo/metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/my-shop/",
          "/profile/",
          "/signin/",
          "/signup/",
          "/forgot-password/",
          "/reset-password/",
        ],
      },
    ],
    sitemap: siteUrl("/sitemap.xml").toString(),
  };
}
