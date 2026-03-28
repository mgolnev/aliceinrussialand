/** Публичный контракт одного элемента `items` в ответе GET /api/feed и SSR ленты. */
export const FEED_POST_JSON_KEYS = [
  "id",
  "slug",
  "title",
  "body",
  "displayMode",
  "publishedAt",
  "pinned",
  "categoryId",
  "category",
  "images",
] as const;

export type FeedPostJsonKey = (typeof FEED_POST_JSON_KEYS)[number];

export function assertFeedPostJsonShape(item: Record<string, unknown>): void {
  for (const key of FEED_POST_JSON_KEYS) {
    if (!(key in item)) {
      throw new Error(`FeedPost JSON missing key: ${key}`);
    }
  }
  const extra = Object.keys(item).filter(
    (k) => !FEED_POST_JSON_KEYS.includes(k as FeedPostJsonKey),
  );
  if (extra.length > 0) {
    throw new Error(`FeedPost JSON has unexpected keys: ${extra.join(", ")}`);
  }
}
