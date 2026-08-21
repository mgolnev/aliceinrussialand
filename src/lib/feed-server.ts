import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { POST_STATUS } from "./constants";
import { parseVariants } from "./posts-query";
import type { FeedCategory, FeedPost } from "@/types/feed";
import { CACHE_TAG_FEED_CATEGORIES, CACHE_TAG_PUBLIC_FEED } from "./cache-tags";
import { isNextProductionBuild } from "./site-settings-db";
import {
  applyPublicFeedListLimits,
  FEED_PUBLIC_MAX_IMAGES_PER_POST,
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

async function getFeedPageUncached(
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
      ...(filterCategoryId
        ? { categoryId: filterCategoryId }
        : { showInAll: true }),
    },
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor
      ? {
          skip: 1,
          cursor: { id: cursor },
        }
      : {}),
    // Явный select: без миграции source* колонок `include` всё равно читает все поля Post и падает.
    select: {
      id: true,
      slug: true,
      title: true,
      body: true,
      displayMode: true,
      publishedAt: true,
      pinned: true,
      showInAll: true,
      categoryId: true,
      projects: {
        where: { project: { status: "PUBLISHED" } },
        orderBy: { sortOrder: "asc" },
        select: {
          project: {
            select: {
              id: true,
              slug: true,
              title: true,
              posts: {
                where: { post: { status: POST_STATUS.PUBLISHED } },
                take: 2,
                select: { id: true },
              },
            },
          },
        },
      },
      images:
        feedProfile === "admin"
          ? {
              orderBy: { sortOrder: "asc" },
              select: {
                id: true,
                caption: true,
                alt: true,
                variantsJson: true,
                width: true,
                height: true,
              },
            }
          : {
              orderBy: { sortOrder: "asc" },
              take: FEED_PUBLIC_MAX_IMAGES_PER_POST,
              select: {
                id: true,
                caption: true,
                alt: true,
                variantsJson: true,
                width: true,
                height: true,
              },
            },
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
      showInAll: p.showInAll,
      categoryId: p.categoryId,
      category: p.category,
      projects: p.projects
        .map((relation) => relation.project)
        .filter((project) => project.posts.length >= 2)
        .map((project) => ({
          id: project.id,
          slug: project.slug,
          title: project.title,
        })),
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

/**
 * Лента — самая тяжёлая публичная выборка. Кешируем только анонимный вариант:
 * в нём нет сессионных кнопок и он одинаков для всех посетителей.
 */
const getCachedPublicFeedPage = unstable_cache(
  async (cursor?: string, categorySlug?: string | null) =>
    getFeedPageUncached(cursor, categorySlug, "public"),
  ["public-feed-page-v1"],
  { tags: [CACHE_TAG_PUBLIC_FEED], revalidate: 120 },
);

export async function getFeedPage(
  cursor?: string,
  categorySlug?: string | null,
  feedProfile: FeedRequestProfile = "public",
): Promise<{
  items: FeedPost[];
  nextCursor: string | null;
  categories: FeedCategory[];
}> {
  if (feedProfile === "public") {
    return getCachedPublicFeedPage(cursor, categorySlug);
  }
  return getFeedPageUncached(cursor, categorySlug, feedProfile);
}
