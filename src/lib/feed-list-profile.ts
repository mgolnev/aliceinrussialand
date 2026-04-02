import type { FeedPost } from "@/types/feed";

/**
 * Публичная лента: ограничиваем число картинок (меньше JSON/RSC), но достаточно для
 * «плиточного» MediaGrid в ленте (несколько фото в карточке). Остальные — на /p/[slug].
 */
export const FEED_PUBLIC_MAX_IMAGES_PER_POST = 12;

/** Ограничение текста в ленте: снижает HTML/RSC и вес гидрации; полный текст на /p/[slug]. */
export const FEED_PUBLIC_BODY_MAX_CHARS = 10_000;

/**
 * Пресеты URL в JSON ленты для гостей: чем меньше ключей, тем легче RSC/HTML.
 * Грид в ленте собирает src/srcSet из 640+960 — этого достаточно для превью;
 * на странице поста по-прежнему полный набор из БД.
 *
 * Откат: верни `"w1280"` в массив ниже.
 */
export const FEED_PUBLIC_IMAGE_VARIANT_KEYS = ["w640", "w960"] as const;

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
