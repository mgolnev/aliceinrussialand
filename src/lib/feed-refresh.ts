/** Событие для подтягивания первой страницы ленты в FeedClient (без перезагрузки вкладки). */
export const ALICE_FEED_REFRESH = "alice-feed-refresh";

export type FeedRefreshDetail = { mode: "merge" | "replace" };

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
