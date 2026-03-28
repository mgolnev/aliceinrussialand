"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { FeedCategory, FeedPost } from "@/types/feed";
import {
  ALICE_FEED_POST_UPDATE,
  ALICE_FEED_REFRESH,
  type FeedPostUpdateDetail,
  type FeedRefreshDetail,
} from "@/lib/feed-refresh";

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
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const nextRef = useRef(initialNext);
  const itemsRef = useRef(initialItems);

  useEffect(() => {
    nextRef.current = next;
  }, [next]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const applyCategory = useCallback(
    (slug: string | null) => {
      setCategorySlug(slug);
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
    if (!next || loading || categoryLoading) return;
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
  }, [next, loading, categoryLoading, categorySlug]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !next) return;

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
  }, [loadMore, next]);

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
        );
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

  const empty = !items.length && !next;

  return {
    categorySlug,
    applyCategory,
    items,
    next,
    loading,
    categoryLoading,
    loadMore,
    empty,
    sentinelRef,
  };
}
