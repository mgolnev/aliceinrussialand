"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { FeedCategory, FeedPost } from "@/types/feed";
import {
  ALICE_FEED_POST_REMOVE,
  ALICE_FEED_POST_UPDATE,
  ALICE_FEED_REFRESH,
  type FeedPostRemoveDetail,
  type FeedPostUpdateDetail,
  type FeedRefreshDetail,
} from "@/lib/feed-refresh";
import { setFeedScrollBridgeSnapshot } from "@/lib/feed-scroll-bridge";
import {
  feedRestoreApplicable,
  feedRestoreIdsPrefixMatch,
  feedRestoreNeedsAsync,
  readFeedBackNavigationFromStorage,
  readRestoreInFlightPayload,
  removeFeedBackNavigationFromStorage,
  removeRestoreInFlightFromStorage,
  takeFeedBackNavigationForAsyncRestore,
} from "@/lib/feed-scroll";

function feedUrl(cursor: string | undefined, categorySlug: string | null) {
  const params = new URLSearchParams();
  if (categorySlug) params.set("category", categorySlug);
  if (cursor) params.set("cursor", cursor);
  const q = params.toString();
  return q ? `/api/feed?${q}` : "/api/feed";
}

function fetchFeed(url: string) {
  return fetch(url, { cache: "no-store" });
}

export type UseFeedPageArgs = {
  initialItems: FeedPost[];
  initialNext: string | null;
  initialCategorySlug?: string | null;
};

export type FeedRestorePhase = "idle" | "skeleton" | "reveal";

export function useFeedPage({
  initialItems,
  initialNext,
  initialCategorySlug = null,
}: UseFeedPageArgs) {
  const router = useRouter();
  const pathname = usePathname();
  const [categorySlug, setCategorySlug] = useState<string | null>(
    initialCategorySlug,
  );
  const [items, setItems] = useState(initialItems);
  const [next, setNext] = useState(initialNext);
  const [loading, setLoading] = useState(false);
  /** Только смена таба категории — скелетон ленты, не путать с «Показать ещё». */
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [feedRestorePhase, setFeedRestorePhase] =
    useState<FeedRestorePhase>("idle");
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const nextRef = useRef(initialNext);
  const itemsRef = useRef(initialItems);
  const scrollAfterRestoreYRef = useRef<number | null>(null);
  /** После merge/replace ленты с API — вернуть window.scrollY (без «прыжка»). */
  const scrollRestoreAfterFeedFetchRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (typeof history === "undefined" || !("scrollRestoration" in history)) {
      return;
    }
    history.scrollRestoration = "manual";
  }, []);

  useEffect(() => {
    nextRef.current = next;
  }, [next]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    setFeedScrollBridgeSnapshot({
      categorySlug,
      postIds: items.map((post) => post.id),
    });
  }, [categorySlug, items]);

  useLayoutEffect(() => {
    const payload = readFeedBackNavigationFromStorage();
    if (!payload) return;
    if (!feedRestoreApplicable(payload, initialCategorySlug, initialItems)) {
      removeFeedBackNavigationFromStorage();
      removeRestoreInFlightFromStorage();
      return;
    }
    if (feedRestoreNeedsAsync(payload, initialItems)) {
      const moved = takeFeedBackNavigationForAsyncRestore();
      if (moved) setFeedRestorePhase("skeleton");
      return;
    }
    if (!feedRestoreIdsPrefixMatch(initialItems, payload.postIds)) {
      removeFeedBackNavigationFromStorage();
      removeRestoreInFlightFromStorage();
      return;
    }
    removeFeedBackNavigationFromStorage();
    removeRestoreInFlightFromStorage();
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    window.scrollTo(0, payload.y);
    html.style.scrollBehavior = prev;
  }, [initialCategorySlug, initialItems]);

  useEffect(() => {
    const payload = readRestoreInFlightPayload();
    if (!payload) return;
    if (!feedRestoreApplicable(payload, initialCategorySlug, initialItems)) {
      removeRestoreInFlightFromStorage();
      setFeedRestorePhase("idle");
      return;
    }
    if (!feedRestoreNeedsAsync(payload, initialItems)) {
      removeRestoreInFlightFromStorage();
      setFeedRestorePhase("idle");
      return;
    }

    let cancelled = false;

    void (async () => {
      let cur = [...initialItems];
      let nextCur = initialNext;
      const targetLen = payload.postIds.length;
      let guard = 0;

      try {
        while (cur.length < targetLen && nextCur && !cancelled && guard++ < 50) {
          const res = await fetchFeed(feedUrl(nextCur, payload.category));
          const data = (await res.json()) as {
            items: FeedPost[];
            nextCursor: string | null;
          };
          const seen = new Set(cur.map((post) => post.id));
          const extra = data.items.filter((post) => !seen.has(post.id));
          if (extra.length > 0) {
            cur = [...cur, ...extra];
          }
          nextCur = data.nextCursor;
          if (extra.length === 0 && !data.nextCursor) break;
        }

        if (cancelled) return;
        if (!feedRestoreIdsPrefixMatch(cur, payload.postIds)) {
          removeRestoreInFlightFromStorage();
          setFeedRestorePhase("idle");
          return;
        }

        scrollAfterRestoreYRef.current = payload.y;
        setCategorySlug(payload.category);
        setItems(cur);
        setNext(nextCur);
        nextRef.current = nextCur;
        itemsRef.current = cur;
        removeRestoreInFlightFromStorage();
        setFeedRestorePhase("reveal");
      } catch {
        if (!cancelled) {
          removeRestoreInFlightFromStorage();
          setFeedRestorePhase("idle");
        }
      }
    })();

    return () => {
      cancelled = true;
      scrollAfterRestoreYRef.current = null;
    };
  }, [initialCategorySlug, initialItems, initialNext]);

  useLayoutEffect(() => {
    if (feedRestorePhase !== "reveal") return;
    const y = scrollAfterRestoreYRef.current;
    scrollAfterRestoreYRef.current = null;
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    if (y != null && Number.isFinite(y)) {
      window.scrollTo(0, y);
    }
    html.style.scrollBehavior = prev;
    setFeedRestorePhase("idle");
  }, [feedRestorePhase]);

  useLayoutEffect(() => {
    const y = scrollRestoreAfterFeedFetchRef.current;
    if (y === null) return;
    scrollRestoreAfterFeedFetchRef.current = null;
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    window.scrollTo(0, y);
    html.style.scrollBehavior = prev;
  }, [items]);

  const applyCategory = useCallback(
    (slug: string | null) => {
      setCategorySlug(slug);
      setFeedRestorePhase("idle");
      removeFeedBackNavigationFromStorage();
      removeRestoreInFlightFromStorage();
      const params = new URLSearchParams();
      if (slug) params.set("category", slug);
      const q = params.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
      if (typeof window !== "undefined") {
        const html = document.documentElement;
        const prev = html.style.scrollBehavior;
        html.style.scrollBehavior = "auto";
        window.scrollTo(0, 0);
        html.style.scrollBehavior = prev;
      }
      setCategoryLoading(true);
      void fetchFeed(feedUrl(undefined, slug))
        .then((r) => r.json())
        .then(
          (data: {
            items: FeedPost[];
            nextCursor: string | null;
            categories?: FeedCategory[];
          }) => {
            setItems(data.items);
            setNext(data.nextCursor);
          },
        )
        .finally(() => setCategoryLoading(false));
    },
    [pathname, router],
  );

  const loadMore = useCallback(async () => {
    if (!next || loading || categoryLoading || feedRestorePhase !== "idle") return;
    setLoading(true);
    try {
      const seen = new Set(itemsRef.current.map((p) => p.id));
      const toAppend: FeedPost[] = [];
      let cursor: string | null = next;
      let finalNext: string | null = null;
      let guard = 0;

      while (cursor && guard++ < 50) {
        const res = await fetchFeed(feedUrl(cursor, categorySlug));
        const data = (await res.json()) as {
          items: FeedPost[];
          nextCursor: string | null;
        };
        const extra = data.items.filter((p) => !seen.has(p.id));
        for (const p of extra) {
          seen.add(p.id);
          toAppend.push(p);
        }

        if (extra.length > 0) {
          finalNext = data.nextCursor;
          break;
        }
        if (data.items.length === 0) {
          finalNext = data.nextCursor;
          break;
        }
        if (!data.nextCursor) {
          finalNext = null;
          break;
        }
        cursor = data.nextCursor;
      }

      if (guard >= 50 && toAppend.length === 0) {
        finalNext = null;
      }

      if (toAppend.length > 0) {
        setItems((prev) => [...prev, ...toAppend]);
      }
      setNext(finalNext);
    } finally {
      setLoading(false);
    }
  }, [next, loading, categoryLoading, categorySlug, feedRestorePhase]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !next || feedRestorePhase !== "idle") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      { rootMargin: "240px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, next, feedRestorePhase]);

  useEffect(() => {
    const handler = (ev: Event) => {
      const mode =
        (ev as CustomEvent<FeedRefreshDetail>).detail?.mode ?? "merge";
      /** До merge: если лента уже без хвоста (next === null), не подставлять курсор первой страницы — иначе sentinel снова тянет «вторую страницу с начала», дублируя хвост. */
      const nextBeforeRefresh = nextRef.current;
      void fetchFeed(feedUrl(undefined, categorySlug))
        .then((r) => r.json())
        .then(
          (data: {
            items: FeedPost[];
            nextCursor: string | null;
          }) => {
            scrollRestoreAfterFeedFetchRef.current = window.scrollY;
            if (mode === "replace") {
              setItems(data.items);
              setNext(data.nextCursor);
              return;
            }
            setItems((prev) => {
              const fresh = data.items;
              const freshIds = new Set(fresh.map((p) => p.id));
              const tail = prev.filter((p) => !freshIds.has(p.id));
              return [...fresh, ...tail];
            });
            setNext(
              nextBeforeRefresh === null ? null : data.nextCursor,
            );
          },
        )
        .catch(() => {
          scrollRestoreAfterFeedFetchRef.current = null;
        });
    };
    window.addEventListener(ALICE_FEED_REFRESH, handler);
    return () => window.removeEventListener(ALICE_FEED_REFRESH, handler);
  }, [categorySlug]);

  useEffect(() => {
    const onPostUpdate = (ev: Event) => {
      const post = (ev as CustomEvent<FeedPostUpdateDetail>).detail?.post;
      if (!post?.id) return;
      setItems((prev) => prev.map((p) => (p.id === post.id ? post : p)));
    };
    window.addEventListener(ALICE_FEED_POST_UPDATE, onPostUpdate);
    return () => window.removeEventListener(ALICE_FEED_POST_UPDATE, onPostUpdate);
  }, []);

  useEffect(() => {
    const onPostRemove = (ev: Event) => {
      const postId = (ev as CustomEvent<FeedPostRemoveDetail>).detail?.postId;
      if (!postId) return;
      setItems((prev) => prev.filter((p) => p.id !== postId));
    };
    window.addEventListener(ALICE_FEED_POST_REMOVE, onPostRemove);
    return () =>
      window.removeEventListener(ALICE_FEED_POST_REMOVE, onPostRemove);
  }, []);

  const empty = !items.length && !next;

  return {
    categorySlug,
    applyCategory,
    items,
    next,
    loading,
    feedRestorePhase,
    categoryLoading,
    loadMore,
    empty,
    sentinelRef,
  };
}
