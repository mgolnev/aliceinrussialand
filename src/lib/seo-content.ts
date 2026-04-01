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
  /** Текст для видимого SEO-блока на странице категории. */
  description: string;
  /** Короткая версия для meta/OG/Twitter. */
  metaDescription: string;
};

export type SeoPostListItem = {
  id: string;
  slug: string;
  title: string;
  body: string;
  updatedAt: Date;
  publishedAt: Date | null;
};

function normalizeReadableText(value: string): string {
  return stripEmojiForSeo(value).replace(/\s+/g, " ").trim();
}

function buildCategoryDescriptions(
  categoryName: string,
  rawDescription: string | null | undefined,
  siteContext: string,
): { description: string; metaDescription: string } {
  const safeRaw = normalizeReadableText(rawDescription ?? "");
  const safeContext = normalizeReadableText(siteContext);
  const contextSentence = safeContext
    ? excerptForMetaDescription(safeContext, 120)
    : "";
  const genericSecondSentence =
    "На странице собраны материалы по теме в удобном формате для чтения.";
  if (safeRaw) {
    const description =
      safeRaw.length >= 90
        ? safeRaw
        : contextSentence
          ? `${safeRaw} ${contextSentence}`
          : `${safeRaw} ${genericSecondSentence}`;
    return {
      description,
      metaDescription: excerptForMetaDescription(description, 180),
    };
  }

  if (contextSentence) {
    const description = `Категория «${categoryName}» объединяет тематические публикации и новые работы. ${contextSentence}`;
    return {
      description,
      metaDescription: excerptForMetaDescription(description, 180),
    };
  }

  const description = `Категория «${categoryName}» объединяет тематические публикации и новые работы. ${genericSecondSentence}`;
  return {
    description,
    metaDescription: excerptForMetaDescription(description, 180),
  };
}

export async function listSeoCategories(siteContext: string): Promise<SeoCategory[]> {
  const rows = await prisma.postCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      updatedAt: true,
      posts: {
        where: { status: POST_STATUS.PUBLISHED },
        select: { id: true },
      },
    },
  });

  return rows
    .map((row) => {
      const resolved = buildCategoryDescriptions(
        row.name,
        row.description,
        siteContext,
      );
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        updatedAt: row.updatedAt,
        postCount: row.posts.length,
        description: resolved.description,
        metaDescription: resolved.metaDescription,
      };
    })
    .filter((row) => row.postCount > 0);
}

export async function getSeoCategoryBySlug(
  slug: string,
  siteContext: string,
): Promise<SeoCategory | null> {
  const row = await prisma.postCategory.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      updatedAt: true,
      posts: {
        where: { status: POST_STATUS.PUBLISHED },
        select: { id: true },
      },
    },
  });
  if (!row) return null;

  const resolved = buildCategoryDescriptions(
    row.name,
    row.description,
    siteContext,
  );
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    updatedAt: row.updatedAt,
    postCount: row.posts.length,
    description: resolved.description,
    metaDescription: resolved.metaDescription,
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

