import type { FeedPost } from "@/types/feed";

/** Публичная лента: одна обложка на карточку (остальное — на странице поста). */
export const FEED_PUBLIC_MAX_IMAGES_PER_POST = 1;

/** Ограничение текста в ленте: снижает HTML/RSC и вес гидрации; полный текст на /p/[slug]. */
export const FEED_PUBLIC_BODY_MAX_CHARS = 10_000;

/** Только пресеты, которые реально отдаём в ленте (меньше JSON). */
export const FEED_PUBLIC_IMAGE_VARIANT_KEYS = [
  "w640",
  "w960",
  "w1280",
] as const;

export type FeedRequestProfile = "public" | "admin";

export function trimImageVariantsForPublicList(
  variants: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of FEED_PUBLIC_IMAGE_VARIANT_KEYS) {
    const v = variants[k];
    if (v) out[k] = v;
  }
  return out;
}

export function truncateBodyForPublicFeed(body: string, max = FEED_PUBLIC_BODY_MAX_CHARS): string {
  const t = body ?? "";
  if (t.length <= max) return t;
  return `${t.slice(0, max).trimEnd()}…`;
}

/** Применить лимиты к уже собранному FeedPost (после map из Prisma). */
export function applyPublicFeedListLimits(post: FeedPost): FeedPost {
  return {
    ...post,
    body: truncateBodyForPublicFeed(post.body),
    images: post.images
      .slice(0, FEED_PUBLIC_MAX_IMAGES_PER_POST)
      .map((im) => ({
        ...im,
        variants: trimImageVariantsForPublicList(im.variants),
      })),
  };
}
