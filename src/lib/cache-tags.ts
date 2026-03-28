import { revalidateTag } from "next/cache";

/** Теги `unstable_cache` / `revalidateTag` — единая точка имён. */
export const CACHE_TAG_FEED_CATEGORIES = "feed-categories";

export function invalidateFeedCategoriesCache() {
  revalidateTag(CACHE_TAG_FEED_CATEGORIES, "default");
}
