import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { POST_STATUS } from "@/lib/constants";
import { getSiteSettings } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getSiteSettings();
  const base =
    settings.siteUrl ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const origin = base.replace(/\/$/, "");

  if (process.env.NEXT_PHASE === "phase-production-build") {
    return [
      { url: `${origin}/`, lastModified: new Date() },
      { url: `${origin}/about`, lastModified: new Date() },
    ];
  }

  const posts = await prisma.post.findMany({
    where: { status: POST_STATUS.PUBLISHED },
    select: { slug: true, updatedAt: true, publishedAt: true },
  });

  const entries: MetadataRoute.Sitemap = [
    { url: `${origin}/`, lastModified: new Date() },
    { url: `${origin}/about`, lastModified: new Date() },
    ...posts.map((p) => ({
      url: `${origin}/p/${p.slug}`,
      lastModified: p.updatedAt ?? p.publishedAt ?? new Date(),
    })),
  ];

  return entries;
}
