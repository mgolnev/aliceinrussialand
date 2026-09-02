import { revalidateTag } from "next/cache";

/** Теги `unstable_cache` / `revalidateTag` — единая точка имён. */
export const CACHE_TAG_FEED_CATEGORIES = "feed-categories";
export const CACHE_TAG_PUBLIC_FEED = "public-feed";
export const CACHE_TAG_WANDER_CATALOGUE = "wander-catalogue";

export function invalidateWanderCatalogueCache() {
  revalidateTag(CACHE_TAG_WANDER_CATALOGUE, "default");
}

export function invalidatePublicFeedCache() {
  revalidateTag(CACHE_TAG_PUBLIC_FEED, "default");
  // Public post/project mutations also change the pool available to /wander.
  invalidateWanderCatalogueCache();
}

export function invalidateFeedCategoriesCache() {
  revalidateTag(CACHE_TAG_FEED_CATEGORIES, "default");
  invalidatePublicFeedCache();
}
