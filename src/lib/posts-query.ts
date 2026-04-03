import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { POST_STATUS } from "./constants";
import { derivePostTitle } from "./post-text";
import { diversifyByCategoryRoundRobin } from "./rec-diversify";
import { shuffleDeterministic, stringToSeed32 } from "./rec-seed";
import type { PostCarouselItem } from "@/types/feed";

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

async function listCategoryIdsByFeedOrder(): Promise<string[]> {
  const rows = await prisma.postCategory.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/**
 * Карусель после поста: слоты из той же категории (скользящее окно по пулу из 24),
 * затем хвост: пулы соседей/остальных по 48, детерминированное перемешивание по id поста,
 * склейка [соседи → остальные] и раунд-робин по категориям.
 */
export async function getPostCarouselPeers(
  currentPostId: string,
  categoryId: string | null,
  opts?: { categoryFirst?: number; totalLimit?: number },
): Promise<PostCarouselItem[]> {
  const categoryFirst = opts?.categoryFirst ?? 5;
  const totalLimit = opts?.totalLimit ?? 16;

  const carouselInclude = {
    images: firstImageInclude,
    category: { select: { name: true, slug: true } },
  } as const;
  type CarouselRow = Prisma.PostGetPayload<{ include: typeof carouselInclude }>;

  const SAME_CATEGORY_POOL_CAP = 24;
  const sameCategoryPool = categoryId
    ? await prisma.post.findMany({
        where: {
          status: POST_STATUS.PUBLISHED,
          id: { not: currentPostId },
          categoryId,
        },
        orderBy: carouselOrderBy,
        take: SAME_CATEGORY_POOL_CAP,
        include: carouselInclude,
      })
    : [];

  let sameCategory: CarouselRow[] = [];
  if (categoryId && sameCategoryPool.length > 0) {
    const takeN = Math.min(categoryFirst, sameCategoryPool.length);
    const maxOffset = Math.max(0, sameCategoryPool.length - takeN);
    const offset =
      maxOffset === 0
        ? 0
        : stringToSeed32(`${currentPostId}:rec-same`) % (maxOffset + 1);
    sameCategory = sameCategoryPool.slice(offset, offset + takeN);
  }

  const excludeIds = [currentPostId, ...sameCategory.map((p) => p.id)];
  const remaining = Math.max(0, totalLimit - sameCategory.length);

  let tail: CarouselRow[] = [];
  if (remaining > 0) {
    const feedOrderIds = await listCategoryIdsByFeedOrder();
    const idx = categoryId ? feedOrderIds.indexOf(categoryId) : -1;
    const neighborIds: string[] = [];
    if (idx >= 0) {
      if (idx > 0) neighborIds.push(feedOrderIds[idx - 1]!);
      if (idx < feedOrderIds.length - 1) neighborIds.push(feedOrderIds[idx + 1]!);
    }

    const neighborRows =
      neighborIds.length > 0
        ? await prisma.post.findMany({
            where: {
              status: POST_STATUS.PUBLISHED,
              id: { notIn: excludeIds },
              categoryId: { in: neighborIds },
            },
            orderBy: carouselOrderBy,
            take: 48,
            include: carouselInclude,
          })
        : [];

    const excludeAfterNeighbors = [...excludeIds, ...neighborRows.map((p) => p.id)];
    const forbiddenCats = new Set<string>();
    if (categoryId) forbiddenCats.add(categoryId);
    for (const id of neighborIds) forbiddenCats.add(id);

    const otherWhere: Prisma.PostWhereInput =
      forbiddenCats.size > 0
        ? {
            status: POST_STATUS.PUBLISHED,
            id: { notIn: excludeAfterNeighbors },
            OR: [
              { categoryId: null },
              { categoryId: { notIn: [...forbiddenCats] } },
            ],
          }
        : {
            status: POST_STATUS.PUBLISHED,
            id: { notIn: excludeAfterNeighbors },
          };

    const otherRows = await prisma.post.findMany({
      where: otherWhere,
      orderBy: carouselOrderBy,
      take: 48,
      include: carouselInclude,
    });

    const shuffledNeighbors = shuffleDeterministic(
      neighborRows,
      `${currentPostId}:rec-n`,
    );
    const shuffledOthers = shuffleDeterministic(otherRows, `${currentPostId}:rec-o`);
    const merged: CarouselRow[] = [...shuffledNeighbors, ...shuffledOthers];
    tail = diversifyByCategoryRoundRobin(merged, remaining);
  }

  return [...sameCategory, ...tail].map(mapPostToCarouselItem);
}

export const getPostCarouselPeersCached = cache(getPostCarouselPeers);

export function parseVariants(json: string): Record<string, string> {
  try {
    const o = JSON.parse(json) as unknown;
    if (o && typeof o === "object") return o as Record<string, string>;
  } catch {
    /* ignore */
  }
  return {};
}
