import { prisma } from "./prisma";
import { POST_STATUS } from "./constants";

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
    },
  });
}

export function parseVariants(json: string): Record<string, string> {
  try {
    const o = JSON.parse(json) as unknown;
    if (o && typeof o === "object") return o as Record<string, string>;
  } catch {
    /* ignore */
  }
  return {};
}
