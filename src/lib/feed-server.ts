import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { POST_STATUS } from "./constants";
import { parseVariants } from "./posts-query";
import type { FeedCategory, FeedPost } from "@/types/feed";
import { CACHE_TAG_FEED_CATEGORIES } from "./cache-tags";
import { isNextProductionBuild } from "./site-settings-db";
import {
  applyPublicFeedListLimits,
  type FeedRequestProfile,
} from "./feed-list-profile";

const take = 8;

/** После смены схемы без `prisma generate` делегат отсутствует — не падаем. */
function postCategoryDb() {
  return (
    prisma as unknown as {
      postCategory?: {
        findMany: (args: {
          orderBy: { sortOrder: "asc" };
          select: {
            id: true;
            name: true;
            slug: true;
            sortOrder: true;
          };
        }) => Promise<FeedCategory[]>;
        findUnique: (args: {
          where: { slug: string };
          select: { id: true };
        }) => Promise<{ id: string } | null>;
      };
    }
  ).postCategory;
}

export async function listFeedCategories(): Promise<FeedCategory[]> {
  if (isNextProductionBuild()) {
    return [];
  }
  const pc = postCategoryDb();
  if (!pc) {
    console.warn(
      "[prisma] Нет модели postCategory в клиенте. Выполните: npx prisma generate и перезапустите сервер.",
    );
    return [];
  }
  return unstable_cache(
    async () => {
      const inner = postCategoryDb();
      if (!inner) return [];
      return inner.findMany({
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, slug: true, sortOrder: true },
      });
    },
    ["list-feed-categories-v1"],
    { tags: [CACHE_TAG_FEED_CATEGORIES], revalidate: 3600 },
  )();
}

export async function getFeedPage(
  cursor?: string,
  categorySlug?: string | null,
  feedProfile: FeedRequestProfile = "public",
): Promise<{
  items: FeedPost[];
  nextCursor: string | null;
  categories: FeedCategory[];
}> {
  if (isNextProductionBuild()) {
    return { items: [], nextCursor: null, categories: [] };
  }

  const normalizedCategory = categorySlug?.trim() || undefined;
  const categoriesPromise = listFeedCategories();
  const filterCategoryIdPromise = (async (): Promise<string | undefined> => {
    if (!normalizedCategory) return undefined;
    const pc = postCategoryDb();
    if (!pc) return undefined;
    const row = await pc.findUnique({
      where: { slug: normalizedCategory },
      select: { id: true },
    });
    return row?.id;
  })();

  const [categories, filterCategoryId] = await Promise.all([
    categoriesPromise,
    filterCategoryIdPromise,
  ]);

  const posts = await prisma.post.findMany({
    where: {
      status: POST_STATUS.PUBLISHED,
      ...(filterCategoryId ? { categoryId: filterCategoryId } : {}),
    },
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor
      ? {
          skip: 1,
          cursor: { id: cursor },
        }
      : {}),
    include: {
      images:
        feedProfile === "admin"
          ? { orderBy: { sortOrder: "asc" } }
          : { orderBy: { sortOrder: "asc" }, take: 1 },
      category: { select: { id: true, name: true, slug: true } },
    },
  });

  const hasMore = posts.length > take;
  const slice = hasMore ? posts.slice(0, take) : posts;
  const nextCursor = hasMore ? (slice[slice.length - 1]?.id ?? null) : null;

  const items: FeedPost[] = slice.map((p) => {
    const row: FeedPost = {
      id: p.id,
      slug: p.slug,
      title: p.title,
      body: p.body,
      displayMode: p.displayMode === "STACK" ? "STACK" : "GRID",
      publishedAt: p.publishedAt?.toISOString() ?? null,
      pinned: p.pinned,
      categoryId: p.categoryId,
      category: p.category,
      images: p.images.map((im) => ({
        id: im.id,
        caption: im.caption,
        alt: im.alt,
        variants: parseVariants(im.variantsJson),
        width: im.width,
        height: im.height,
      })),
    };
    return feedProfile === "public" ? applyPublicFeedListLimits(row) : row;
  });

  return { items, nextCursor, categories };
}
