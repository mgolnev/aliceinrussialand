import type { FeedPost } from "@/types/feed";

/** Событие для подтягивания первой страницы ленты (HomePageClient / useFeedPage). */
export const ALICE_FEED_REFRESH = "alice-feed-refresh";

/** Точечное обновление карточки после PATCH поста (без ожидания кэша /api/feed). */
export const ALICE_FEED_POST_UPDATE = "alice-feed-post-update";

export type FeedRefreshDetail = { mode: "merge" | "replace" };

export type FeedPostUpdateDetail = { post: FeedPost };

export function dispatchFeedRefreshMerge() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<FeedRefreshDetail>(ALICE_FEED_REFRESH, {
        detail: { mode: "merge" },
      }),
    );
  }
}

/** Сбросить список к первой странице API (после удаления / снятия с публикации). */
export function dispatchFeedRefreshReplace() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<FeedRefreshDetail>(ALICE_FEED_REFRESH, {
        detail: { mode: "replace" },
      }),
    );
  }
}

export function dispatchFeedPostUpdate(post: FeedPost) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent<FeedPostUpdateDetail>(ALICE_FEED_POST_UPDATE, {
        detail: { post },
      }),
    );
  }
}
