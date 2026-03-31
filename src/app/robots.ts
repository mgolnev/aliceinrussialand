import type { MetadataRoute } from "next";
import { getSiteSettings } from "@/lib/site";
import { resolveSiteOrigin } from "@/lib/site-origin";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSiteSettings();
  const origin = resolveSiteOrigin(settings.siteUrl);

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/"],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
