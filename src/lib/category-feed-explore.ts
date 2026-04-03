import { prisma } from "./prisma";
import { POST_STATUS } from "./constants";
import { parseVariants } from "./posts-query";
import { derivePostTitle } from "./post-text";
import { listFeedCategories } from "./feed-server";
import { isNextProductionBuild } from "./site-settings-db";
import { compareCarouselQuality, diversifyByCategoryRoundRobin } from "./rec-diversify";
import { indexFromSeed, shuffleDeterministic } from "./rec-seed";
import type { CategoryExplorePost, CategoryFeedExplorePayload, FeedCategory } from "@/types/feed";

const firstImageInclude = {
  orderBy: { sortOrder: "asc" as const },
  take: 1,
  select: {
    alt: true,
    variantsJson: true,
    width: true,
    height: true,
  },
} as const;

function mapExplorePost(p: {
  slug: string;
  title: string;
  body: string;
  images: Array<{
    alt: string;
    variantsJson: string;
    width: number | null;
    height: number | null;
  }>;
  category: { name: string; slug: string } | null;
}): CategoryExplorePost {
  const im = p.images[0];
  const variants = im ? parseVariants(im.variantsJson) : {};
  const title = derivePostTitle(p.title, p.body);
  const normalizedBody = p.body.replace(/\s+/g, " ").trim();
  const preview = (normalizedBody || title).slice(0, 500);
  const letter = title.trim().slice(0, 1).toUpperCase() || "•";
  return {
    slug: p.slug,
    title,
    preview,
    displayLetter: letter,
    categoryName: p.category?.name?.trim() || "Без темы",
    categorySlug: p.category?.slug?.trim() ?? "",
    variants,
    width: im?.width ?? null,
    height: im?.height ?? null,
    alt: (im?.alt?.trim() ? im.alt : title) || title,
  };
}

/**
 * Контент для блока «ещё вдохновения» в конце ленты категории:
 * главный пост (приоритет соседним категориям по sortOrder), карусель, чипы тем.
 */
export async function getCategoryFeedExplore(
  categorySlug: string,
): Promise<CategoryFeedExplorePayload | null> {
  if (isNextProductionBuild()) {
    return null;
  }
  const slug = categorySlug.trim();
  if (!slug) return null;

  const categories = await listFeedCategories();
  const idx = categories.findIndex((c) => c.slug === slug);
  if (idx < 0) return null;

  const current = categories[idx];
  const neighborIds: string[] = [];
  if (idx > 0) neighborIds.push(categories[idx - 1]!.id);
  if (idx < categories.length - 1) neighborIds.push(categories[idx + 1]!.id);

  const notCurrent = { not: current.id } as const;

  const postInclude = {
    images: firstImageInclude,
    category: { select: { name: true, slug: true } },
  } as const;

  const carouselOrder = [
    { pinned: "desc" as const },
    { publishedAt: "desc" as const },
    { id: "desc" as const },
  ];

  async function bestPostInCategory(categoryId: string) {
    return prisma.post.findFirst({
      where: { status: POST_STATUS.PUBLISHED, categoryId },
      orderBy: carouselOrder,
      include: postInclude,
    });
  }

  let featuredRow: Awaited<ReturnType<typeof bestPostInCategory>> = null;
  if (neighborIds.length > 0) {
    const tops = await Promise.all(neighborIds.map((id) => bestPostInCategory(id)));
    const candidates = tops.filter(Boolean) as NonNullable<(typeof tops)[number]>[];
    if (candidates.length > 0) {
      const ranked = [...candidates].sort((a, b) => compareCarouselQuality(a, b));
      const window = Math.min(4, ranked.length);
      featuredRow = ranked[indexFromSeed(`${slug}:rec-feat`, window)]!;
    }
  }
  if (!featuredRow) {
    const pool = await prisma.post.findMany({
      where: {
        status: POST_STATUS.PUBLISHED,
        categoryId: notCurrent,
      },
      orderBy: carouselOrder,
      take: 14,
      include: postInclude,
    });
    if (pool.length > 0) {
      const ranked = [...pool].sort((a, b) => compareCarouselQuality(a, b));
      const window = Math.min(5, ranked.length);
      featuredRow = ranked[indexFromSeed(`${slug}:rec-feat-fb`, window)]!;
    }
  }

  const excludeIds = featuredRow ? [featuredRow.id] : [];
  const moreCandidates = await prisma.post.findMany({
    where: {
      status: POST_STATUS.PUBLISHED,
      categoryId: notCurrent,
      ...(excludeIds.length ? { id: { notIn: excludeIds } } : {}),
    },
    orderBy: carouselOrder,
    take: 48,
    include: postInclude,
  });
  const moreShuffled = shuffleDeterministic(moreCandidates, `${slug}:rec-more`);
  const moreRows = diversifyByCategoryRoundRobin(moreShuffled, 6);

  const topics: FeedCategory[] = categories
    .filter((c) => c.id !== current.id)
    .slice(0, 5);

  return {
    currentCategoryName: current.name,
    currentCategorySlug: current.slug,
    featured: featuredRow ? mapExplorePost(featuredRow) : null,
    more: moreRows.map(mapExplorePost),
    topics,
  };
}
