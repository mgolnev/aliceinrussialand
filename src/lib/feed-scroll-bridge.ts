export type FeedScrollBridgeSnapshot = {
  categorySlug: string | null;
  postIds: string[];
};

let snapshot: FeedScrollBridgeSnapshot = {
  categorySlug: null,
  postIds: [],
};

export function setFeedScrollBridgeSnapshot(nextSnapshot: FeedScrollBridgeSnapshot) {
  snapshot = nextSnapshot;
}

export function getFeedScrollBridgeSnapshot(): FeedScrollBridgeSnapshot {
  return snapshot;
}
