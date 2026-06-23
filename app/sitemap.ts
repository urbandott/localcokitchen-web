import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo/metadata";

const publicRoutes = [
  "/",
  "/search/",
  "/menu/",
  "/find-a-meal/",
  "/sell-your-food/",
  "/how-it-works/",
  "/mission/",
  "/faq/",
  "/contact-us/",
  "/privacy-policy/",
  "/terms-and-conditions/",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map((route) => ({
    url: siteUrl(route).toString(),
    lastModified: new Date("2026-06-23"),
    changeFrequency: route === "/menu/" ? "hourly" : "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
