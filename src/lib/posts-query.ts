import { cache } from "react";
import { prisma } from "./prisma";
import { POST_STATUS } from "./constants";
import { derivePostTitle } from "./post-text";
import type { PostCarouselItem, PostReadNextPayload } from "@/types/feed";

const imageSelect = {
  id: true,
  sortOrder: true,
  caption: true,
  alt: true,
  variantsJson: true,
  width: true,
  height: true,
} as const;

export function getPublishedPostsQuery(take = 12, cursor?: string) {
  return prisma.post.findMany({
    where: { status: POST_STATUS.PUBLISHED },
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
    take: take + 1,
    ...(cursor
      ? {
          skip: 1,
          cursor: { id: cursor },
        }
      : {}),
    include: {
      images: { orderBy: { sortOrder: "asc" }, select: imageSelect },
    },
  });
}

export async function getPublishedPostBySlug(slug: string) {
  return prisma.post.findFirst({
    where: { slug, status: POST_STATUS.PUBLISHED },
    include: {
      images: { orderBy: { sortOrder: "asc" }, select: imageSelect },
      category: { select: { id: true, name: true, slug: true } },
    },
  });
}

/** Полные варианты URL картинок опубликованного поста (для лайтбокса из ленты). */
export async function getPublishedPostMediaBySlug(slug: string): Promise<{
  images: Array<{ id: string; variants: Record<string, string> }>;
} | null> {
  const post = await prisma.post.findFirst({
    where: { slug, status: POST_STATUS.PUBLISHED },
    select: {
      images: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, variantsJson: true },
      },
    },
  });
  if (!post) return null;
  return {
    images: post.images.map((im) => ({
      id: im.id,
      variants: parseVariants(im.variantsJson),
    })),
  };
}

/** Дедуп вызова в `generateMetadata` и `PostPage` в одном запросе. */
export const getPublishedPostBySlugCached = cache(getPublishedPostBySlug);

const carouselOrderBy = [
  { pinned: "desc" as const },
  { publishedAt: "desc" as const },
  { id: "desc" as const },
];

const firstImageInclude = {
  orderBy: { sortOrder: "asc" as const },
  take: 1,
  select: imageSelect,
} as const;

function mapPostToCarouselItem(p: {
  slug: string;
  title: string;
  body: string;
  category: { name: string; slug: string } | null;
  images: Array<{
    alt: string;
    variantsJson: string;
    width: number | null;
    height: number | null;
  }>;
}): PostCarouselItem {
  const im = p.images[0];
  const variants = im ? parseVariants(im.variantsJson) : {};
  const title = derivePostTitle(p.title, p.body);
  const normalizedBody = p.body.replace(/\s+/g, " ").trim();
  /** В карусели только тело поста (без отдельного заголовка), чтобы не дублировать первую строку. */
  const preview = normalizedBody || title;
  const previewCapped = preview.slice(0, 900);
  return {
    slug: p.slug,
    title,
    preview: previewCapped,
    categoryName: p.category?.name?.trim() || "Без темы",
    categorySlug: p.category?.slug?.trim() ?? "",
    variants,
    width: im?.width ?? null,
    height: im?.height ?? null,
    alt: (im?.alt?.trim() ? im.alt : title) || title,
  };
}

const postReadNextInclude = {
  images: firstImageInclude,
  category: { select: { name: true, slug: true } },
} as const;

/**
 * Рекомендации после поста: сначала рубрика текущего материала, затем отдельный
 * пул из соседних рубрик (по порядку в настройках) и общей ленты — без смешивания
 * в одну простыню и без циклического импорта с `feed-server` (соседей передают с page).
 */
export async function getPostReadNextForPostPage(
  currentPostId: string,
  categoryId: string | null,
  neighborCategoryIds: string[],
  opts?: { inCategoryLimit?: number; beyondLimit?: number },
): Promise<PostReadNextPayload> {
  const inCategoryLimit = opts?.inCategoryLimit ?? 5;
  const beyondLimit = opts?.beyondLimit ?? 8;

  const sameCategory = categoryId
    ? await prisma.post.findMany({
        where: {
          status: POST_STATUS.PUBLISHED,
          id: { not: currentPostId },
          categoryId,
        },
        orderBy: carouselOrderBy,
        take: inCategoryLimit,
        include: postReadNextInclude,
      })
    : [];

  const excludeIds = new Set<string>([
    currentPostId,
    ...sameCategory.map((p) => p.id),
  ]);

  type Row = (typeof sameCategory)[number];
  const beyondRows: Row[] = [];

  const neighborIds = neighborCategoryIds.filter(Boolean);
  const neighborCap = Math.min(4, beyondLimit);
  if (neighborIds.length > 0 && neighborCap > 0) {
    const neighborPosts = await prisma.post.findMany({
      where: {
        status: POST_STATUS.PUBLISHED,
        id: { notIn: [...excludeIds] },
        categoryId: { in: neighborIds },
      },
      orderBy: carouselOrderBy,
      take: neighborCap,
      include: postReadNextInclude,
    });
    for (const p of neighborPosts) {
      beyondRows.push(p);
      excludeIds.add(p.id);
    }
  }

  const remaining = beyondLimit - beyondRows.length;
  if (remaining > 0) {
    const rest = await prisma.post.findMany({
      where: {
        status: POST_STATUS.PUBLISHED,
        id: { notIn: [...excludeIds] },
      },
      orderBy: carouselOrderBy,
      take: remaining,
      include: postReadNextInclude,
    });
    beyondRows.push(...rest);
  }

  return {
    inCategory: sameCategory.map(mapPostToCarouselItem),
    beyond: beyondRows.map(mapPostToCarouselItem),
  };
}

export const getPostReadNextForPostPageCached = cache(getPostReadNextForPostPage);

export function parseVariants(json: string): Record<string, string> {
  try {
    const o = JSON.parse(json) as unknown;
    if (o && typeof o === "object") return o as Record<string, string>;
  } catch {
    /* ignore */
  }
  return {};
}
