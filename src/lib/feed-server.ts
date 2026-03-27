import { prisma } from "./prisma";
import { POST_STATUS } from "./constants";
import { parseVariants } from "./posts-query";
import type { FeedPost } from "@/types/feed";

const take = 8;

export async function getFeedPage(cursor?: string): Promise<{
  items: FeedPost[];
  nextCursor: string | null;
}> {
  const posts = await prisma.post.findMany({
    where: { status: POST_STATUS.PUBLISHED },
    orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor
      ? {
          skip: 1,
          cursor: { id: cursor },
        }
      : {}),
    include: {
      images: { orderBy: { sortOrder: "asc" } },
    },
  });

  const hasMore = posts.length > take;
  const slice = hasMore ? posts.slice(0, take) : posts;
  const nextCursor = hasMore ? (slice[slice.length - 1]?.id ?? null) : null;

  const items: FeedPost[] = slice.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    body: p.body,
    displayMode: p.displayMode === "STACK" ? "STACK" : "GRID",
    publishedAt: p.publishedAt?.toISOString() ?? null,
    pinned: p.pinned,
    images: p.images.map((im) => ({
      id: im.id,
      caption: im.caption,
      alt: im.alt,
      variants: parseVariants(im.variantsJson),
      width: im.width,
      height: im.height,
    })),
  }));

  return { items, nextCursor };
}
