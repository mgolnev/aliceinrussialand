import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { POST_STATUS } from "@/lib/constants";
import { getSiteSettings } from "@/lib/site";
import { resolveSiteOrigin } from "@/lib/site-origin";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getSiteSettings();
  const origin = resolveSiteOrigin(settings.siteUrl);
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${origin}/`, lastModified: new Date() },
    { url: `${origin}/about`, lastModified: new Date() },
  ];

  try {
    const posts = await prisma.post.findMany({
      where: { status: POST_STATUS.PUBLISHED },
      select: { slug: true, updatedAt: true, publishedAt: true },
    });
    return [
      ...staticEntries,
      ...posts.map((p) => ({
        url: `${origin}/p/${p.slug}`,
        lastModified: p.updatedAt ?? p.publishedAt ?? new Date(),
      })),
    ];
  } catch {
    return staticEntries;
  }
}
