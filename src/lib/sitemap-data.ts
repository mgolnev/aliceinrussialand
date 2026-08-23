import { absoluteUrl } from "./absolute-url";
import { POST_STATUS } from "./constants";
import {
  imageUrlsForSitemap,
  normalizeImageUrlForSitemap,
} from "./image-sitemap";
import { prisma } from "./prisma";
import { PROJECT_STATUS } from "./projects";
import { SEO_PAGE_SIZE, listSeoCategories } from "./seo-content";
import { parseAboutPhotoUrl, parseAvatarUrl } from "./site";
import { querySiteSettingsRow } from "./site-settings-db";
import { resolveSiteOrigin } from "./site-origin";
import type { SitemapIndexEntry, SitemapUrlEntry } from "./sitemap-xml";

/**
 * 4 страницы * максимум 1000 картинок * максимум 2048 символов URL остаются
 * ниже лимита 50 МБ даже при максимальном XML-экранировании каждого символа.
 */
export const POSTS_PER_IMAGE_SITEMAP = 4;
const SHARD_BOUNDARY_SCAN_SIZE = 1000;

export function fallbackSitemapEntries(
  origin = resolveSiteOrigin(),
): SitemapUrlEntry[] {
  return ["/", "/about", "/archive"].map((path) => ({
    url: absoluteUrl(origin, path),
  }));
}

export function fallbackSitemapIndexEntries(
  origin = resolveSiteOrigin(),
): SitemapIndexEntry[] {
  return [{ url: absoluteUrl(origin, "/sitemaps/fallback.xml") }];
}

async function loadPostShardIds(): Promise<string[][]> {
  const shards: string[][] = [];
  let currentShard: string[] = [];
  let lastId: string | null = null;

  while (true) {
    const posts: Array<{ id: string }> = await prisma.post.findMany({
      where: {
        status: POST_STATUS.PUBLISHED,
        ...(lastId ? { id: { gt: lastId } } : {}),
      },
      orderBy: { id: "asc" },
      take: SHARD_BOUNDARY_SCAN_SIZE,
      select: { id: true },
    });
    if (!posts.length) break;

    for (const post of posts) {
      currentShard.push(post.id);
      if (currentShard.length === POSTS_PER_IMAGE_SITEMAP) {
        shards.push(currentShard);
        currentShard = [];
      }
    }
    lastId = posts.at(-1)?.id ?? null;
    if (posts.length < SHARD_BOUNDARY_SCAN_SIZE) break;
  }

  if (currentShard.length) shards.push(currentShard);
  return shards;
}

export async function loadSitemapIndexEntries(): Promise<SitemapIndexEntry[]> {
  const [settings, postShards] = await Promise.all([
    querySiteSettingsRow(),
    loadPostShardIds(),
  ]);
  const origin = resolveSiteOrigin(settings.siteUrl);

  return [
    { url: absoluteUrl(origin, "/sitemaps/pages.xml") },
    ...postShards.map((ids) => {
      const url = new URL(absoluteUrl(origin, "/sitemaps/posts.xml"));
      url.searchParams.set("ids", ids.join(","));
      return { url: url.toString() };
    }),
  ];
}

function latestDate(dates: Array<Date | null | undefined>, fallback: Date): Date {
  return dates.reduce<Date>(
    (latest, date) => (date && date > latest ? date : latest),
    fallback,
  );
}

export async function loadPagesSitemapEntries(): Promise<SitemapUrlEntry[]> {
  const settings = await querySiteSettingsRow();
  const origin = resolveSiteOrigin(settings.siteUrl);
  const [categories, projects, postsCount, latestPost] = await Promise.all([
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
          take: 2,
          select: { id: true },
        },
      },
    }),
    prisma.post.count({ where: { status: POST_STATUS.PUBLISHED } }),
    prisma.post.aggregate({
      where: { status: POST_STATUS.PUBLISHED },
      _max: { updatedAt: true, publishedAt: true },
    }),
  ]);
  const contentLastModified = latestDate(
    [
      settings.updatedAt,
      latestPost._max.updatedAt,
      latestPost._max.publishedAt,
      ...categories.map((category) => category.updatedAt),
      ...projects.map((project) => project.updatedAt),
    ],
    settings.updatedAt,
  );
  const profileImagePath =
    parseAboutPhotoUrl(settings.aboutPhotoPath) ??
    parseAvatarUrl(settings.avatarMediaPath);
  const profileImage = profileImagePath
    ? normalizeImageUrlForSitemap(origin, profileImagePath)
    : null;
  const archivePages = Math.ceil(postsCount / SEO_PAGE_SIZE);

  return [
    { url: `${origin}/`, lastModified: contentLastModified },
    {
      url: `${origin}/about`,
      lastModified: settings.updatedAt,
      ...(profileImage ? { images: [profileImage] } : {}),
    },
    { url: `${origin}/archive`, lastModified: contentLastModified },
    ...Array.from({ length: Math.max(0, archivePages - 1) }, (_, index) => ({
      url: `${origin}/archive?page=${index + 2}`,
      lastModified: contentLastModified,
    })),
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
  ];
}

export async function loadPostSitemapEntries(
  postIds: string[],
): Promise<SitemapUrlEntry[]> {
  if (!postIds.length || postIds.length > POSTS_PER_IMAGE_SITEMAP) return [];
  const settings = await querySiteSettingsRow();
  const origin = resolveSiteOrigin(settings.siteUrl);
  const posts = await prisma.post.findMany({
    where: {
      status: POST_STATUS.PUBLISHED,
      id: { in: postIds },
    },
    orderBy: { id: "asc" },
    select: {
      slug: true,
      updatedAt: true,
      publishedAt: true,
      images: {
        orderBy: { sortOrder: "asc" },
        select: { variantsJson: true },
      },
    },
  });

  return posts.map((post) => {
    const images = imageUrlsForSitemap(origin, post.images);
    return {
      url: absoluteUrl(origin, `/p/${post.slug}`),
      lastModified: post.updatedAt ?? post.publishedAt ?? undefined,
      ...(images.length ? { images } : {}),
    };
  });
}
