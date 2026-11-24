import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/brand";

const PAGES = ["", "/pricing", "/voices", "/login", "/terms", "/privacy", "/refunds", "/acceptable-use"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((p) => ({ url: `${SITE_URL}${p}`, changeFrequency: "monthly", priority: p === "" ? 1 : 0.6 }));
}
