import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { POST_STATUS } from "@/lib/constants";
import { getSiteSettings } from "@/lib/site";
import { resolveSiteOrigin } from "@/lib/site-origin";
import { listSeoCategories, SEO_PAGE_SIZE } from "@/lib/seo-content";
import { PROJECT_STATUS } from "@/lib/projects";

// Карта зависит от записей в БД. Без явной динамики Next может построить её
// во время сборки, когда база на Amvera ещё недоступна, и закешировать только
// служебные URL.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getSiteSettings();
  const origin = resolveSiteOrigin(settings.siteUrl);
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${origin}/`, lastModified: new Date() },
    { url: `${origin}/about`, lastModified: new Date() },
    { url: `${origin}/archive`, lastModified: new Date() },
  ];

  try {
    const [posts, categories, projects, postsCount] = await Promise.all([
      prisma.post.findMany({
        where: { status: POST_STATUS.PUBLISHED },
        select: { slug: true, updatedAt: true, publishedAt: true },
      }),
      listSeoCategories([settings.tagline, settings.bio].filter(Boolean).join(" ")),
      prisma.project.findMany({
        where: {
          status: PROJECT_STATUS.PUBLISHED,
          posts: { some: { post: { status: POST_STATUS.PUBLISHED } } },
        },
        select: {
          slug: true,
          updatedAt: true,
          posts: {
            where: { post: { status: POST_STATUS.PUBLISHED } },
            select: { id: true },
          },
        },
      }),
      prisma.post.count({ where: { status: POST_STATUS.PUBLISHED } }),
    ]);
    const archivePages = Math.ceil(postsCount / SEO_PAGE_SIZE);
    const archiveEntries: MetadataRoute.Sitemap = Array.from(
      { length: Math.max(0, archivePages - 1) },
      (_, idx) => ({
        url: `${origin}/archive?page=${idx + 2}`,
        lastModified: new Date(),
      }),
    );
    return [
      ...staticEntries,
      ...archiveEntries,
      ...categories.map((category) => ({
        url: `${origin}/category/${category.slug}`,
        lastModified: category.updatedAt,
      })),
      ...projects
        .filter((project) => project.posts.length >= 2)
        .map((project) => ({
          url: `${origin}/projects/${project.slug}`,
          lastModified: project.updatedAt,
        })),
      ...posts.map((p) => ({
        url: `${origin}/p/${p.slug}`,
        lastModified: p.updatedAt ?? p.publishedAt ?? new Date(),
      })),
    ];
  } catch {
    return staticEntries;
  }
}
