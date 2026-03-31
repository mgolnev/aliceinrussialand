import type { FeedPost } from "@/types/feed";

const BACK_NAV_KEY = "alice-feed-back-nav-v1";
const RESTORE_IN_FLIGHT_KEY = "alice-feed-restore-in-flight-v1";

export type FeedBackNavigationPayload = {
  y: number;
  category: string | null;
  postIds: string[];
};

function normalizeCategory(c: string | null | undefined): string | null {
  const t = c?.trim();
  return t ? t : null;
}

function parsePayload(raw: string): FeedBackNavigationPayload | null {
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v !== "object" || v === null) return null;
    const y = (v as { y?: unknown }).y;
    const postIds = (v as { postIds?: unknown }).postIds;
    const category = (v as { category?: unknown }).category;
    if (typeof y !== "number" || !Number.isFinite(y) || y < 0) return null;
    if (!Array.isArray(postIds) || !postIds.every((id) => typeof id === "string")) {
      return null;
    }
    const cat =
      category === null || category === undefined
        ? null
        : typeof category === "string"
          ? normalizeCategory(category)
          : null;
    return { y, category: cat, postIds };
  } catch {
    return null;
  }
}

export function saveFeedBackNavigation(payload: FeedBackNavigationPayload) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(BACK_NAV_KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function readFeedBackNavigationFromStorage(): FeedBackNavigationPayload | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(BACK_NAV_KEY);
  if (!raw) return null;
  return parsePayload(raw);
}

export function removeFeedBackNavigationFromStorage() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(BACK_NAV_KEY);
}

export function readRestoreInFlightPayload(): FeedBackNavigationPayload | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(RESTORE_IN_FLIGHT_KEY);
  if (!raw) return null;
  return parsePayload(raw);
}

export function removeRestoreInFlightFromStorage() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(RESTORE_IN_FLIGHT_KEY);
}

export function takeFeedBackNavigationForAsyncRestore(): FeedBackNavigationPayload | null {
  if (typeof window === "undefined") return null;
  const inflight = sessionStorage.getItem(RESTORE_IN_FLIGHT_KEY);
  if (inflight) {
    const existing = parsePayload(inflight);
    if (!existing) {
      sessionStorage.removeItem(RESTORE_IN_FLIGHT_KEY);
      return null;
    }
    return existing;
  }
  const raw = sessionStorage.getItem(BACK_NAV_KEY);
  if (!raw) return null;
  const parsed = parsePayload(raw);
  if (!parsed) {
    sessionStorage.removeItem(BACK_NAV_KEY);
    return null;
  }
  try {
    sessionStorage.setItem(RESTORE_IN_FLIGHT_KEY, raw);
    sessionStorage.removeItem(BACK_NAV_KEY);
  } catch {
    return null;
  }
  return parsed;
}

export function feedRestoreApplicable(
  payload: FeedBackNavigationPayload,
  initialCategorySlug: string | null | undefined,
  initialItems: FeedPost[],
): boolean {
  if (!payload.postIds.length) return false;
  if (normalizeCategory(payload.category) !== normalizeCategory(initialCategorySlug)) {
    return false;
  }
  return initialItems[0]?.id === payload.postIds[0];
}

export function feedRestoreIdsPrefixMatch(
  posts: FeedPost[],
  targetIds: string[],
): boolean {
  if (targetIds.length > posts.length) return false;
  return targetIds.every((id, index) => posts[index]?.id === id);
}

export function feedRestoreNeedsAsync(
  payload: FeedBackNavigationPayload,
  initialItems: FeedPost[],
): boolean {
  return payload.postIds.length > initialItems.length;
}
