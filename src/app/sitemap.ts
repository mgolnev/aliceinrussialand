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

function latestDate(dates: Array<Date | null | undefined>, fallback: Date): Date {
  return dates.reduce<Date>(
    (latest, date) => (date && date > latest ? date : latest),
    fallback,
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getSiteSettings();
  const origin = resolveSiteOrigin(settings.siteUrl);
  const settingsLastModified = settings.updatedAt;
  const fallbackEntries: MetadataRoute.Sitemap = [
    { url: `${origin}/`, lastModified: settingsLastModified },
    { url: `${origin}/about`, lastModified: settingsLastModified },
    { url: `${origin}/archive`, lastModified: settingsLastModified },
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
    const contentLastModified = latestDate(
      [
        settingsLastModified,
        ...posts.map((post) => post.updatedAt ?? post.publishedAt),
        ...categories.map((category) => category.updatedAt),
        ...projects.map((project) => project.updatedAt),
      ],
      settingsLastModified,
    );
    const staticEntries: MetadataRoute.Sitemap = [
      { url: `${origin}/`, lastModified: contentLastModified },
      { url: `${origin}/about`, lastModified: settingsLastModified },
      { url: `${origin}/archive`, lastModified: contentLastModified },
    ];
    const archivePages = Math.ceil(postsCount / SEO_PAGE_SIZE);
    const archiveEntries: MetadataRoute.Sitemap = Array.from(
      { length: Math.max(0, archivePages - 1) },
      (_, idx) => ({
        url: `${origin}/archive?page=${idx + 2}`,
        lastModified: contentLastModified,
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
        lastModified: p.updatedAt ?? p.publishedAt ?? contentLastModified,
      })),
    ];
  } catch {
    return fallbackEntries;
  }
}
