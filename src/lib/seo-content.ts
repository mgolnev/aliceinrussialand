import { prisma } from "@/lib/prisma";
import { POST_STATUS } from "@/lib/constants";
import { excerptForMetaDescription } from "@/lib/meta-excerpt";
import { stripEmojiForSeo } from "@/lib/seo-sanitize";

export const SEO_PAGE_SIZE = 24;

export type SeoCategory = {
  id: string;
  slug: string;
  name: string;
  updatedAt: Date;
  postCount: number;
  description: string;
};

export type SeoPostListItem = {
  id: string;
  slug: string;
  title: string;
  body: string;
  updatedAt: Date;
  publishedAt: Date | null;
};

function buildCategoryDescription(
  categoryName: string,
  rawDescription: string | null | undefined,
  siteTagline: string,
): string {
  const safeRaw = stripEmojiForSeo(rawDescription?.trim() ?? "");
  if (safeRaw) return excerptForMetaDescription(safeRaw, 180);
  const safeTagline = stripEmojiForSeo(siteTagline.trim());
  if (safeTagline) {
    return `${categoryName} — ${excerptForMetaDescription(safeTagline, 130)}`;
  }
  return `Подборка публикаций в категории «${categoryName}».`;
}

export async function listSeoCategories(siteTagline: string): Promise<SeoCategory[]> {
  const rows = await prisma.postCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      updatedAt: true,
      posts: {
        where: { status: POST_STATUS.PUBLISHED },
        select: { id: true },
      },
    },
  });

  return rows
    .map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      updatedAt: row.updatedAt,
      postCount: row.posts.length,
      description: buildCategoryDescription(row.name, null, siteTagline),
    }))
    .filter((row) => row.postCount > 0);
}

export async function getSeoCategoryBySlug(
  slug: string,
  siteTagline: string,
): Promise<SeoCategory | null> {
  const row = await prisma.postCategory.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      updatedAt: true,
      posts: {
        where: { status: POST_STATUS.PUBLISHED },
        select: { id: true },
      },
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    updatedAt: row.updatedAt,
    postCount: row.posts.length,
    description: buildCategoryDescription(row.name, null, siteTagline),
  };
}

export async function getSeoCategoryPostsPage(
  categoryId: string,
  page: number,
  pageSize: number = SEO_PAGE_SIZE,
): Promise<{
  items: SeoPostListItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const normalizedPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const skip = (normalizedPage - 1) * pageSize;

  const [total, items] = await Promise.all([
    prisma.post.count({
      where: {
        status: POST_STATUS.PUBLISHED,
        categoryId,
      },
    }),
    prisma.post.findMany({
      where: {
        status: POST_STATUS.PUBLISHED,
        categoryId,
      },
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }, { id: "desc" }],
      skip,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        title: true,
        body: true,
        updatedAt: true,
        publishedAt: true,
      },
    }),
  ]);

  return { total, items, page: normalizedPage, pageSize };
}

export async function getArchivePostsPage(
  page: number,
  pageSize: number = SEO_PAGE_SIZE,
): Promise<{
  items: SeoPostListItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const normalizedPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const skip = (normalizedPage - 1) * pageSize;

  const [total, items] = await Promise.all([
    prisma.post.count({
      where: { status: POST_STATUS.PUBLISHED },
    }),
    prisma.post.findMany({
      where: { status: POST_STATUS.PUBLISHED },
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }, { id: "desc" }],
      skip,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        title: true,
        body: true,
        updatedAt: true,
        publishedAt: true,
      },
    }),
  ]);

  return { total, items, page: normalizedPage, pageSize };
}

export function parsePageNumber(raw: string | undefined): number {
  if (!raw) return 1;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

