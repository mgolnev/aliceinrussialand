"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { FeedCategory, FeedPost } from "@/types/feed";
import {
  ALICE_FEED_REFRESH,
  type FeedRefreshDetail,
} from "@/lib/feed-refresh";

function feedUrl(cursor: string | undefined, categorySlug: string | null) {
  const params = new URLSearchParams();
  if (categorySlug) params.set("category", categorySlug);
  if (cursor) params.set("cursor", cursor);
  const q = params.toString();
  return q ? `/api/feed?${q}` : "/api/feed";
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
  const sentinelRef = useRef<HTMLDivElement | null>(null);

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
      setLoading(true);
      void fetch(feedUrl(undefined, slug))
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
        .finally(() => setLoading(false));
    },
    [pathname, router],
  );

  const loadMore = useCallback(async () => {
    if (!next || loading) return;
    setLoading(true);
    try {
      const res = await fetch(feedUrl(next, categorySlug));
      const data = (await res.json()) as {
        items: FeedPost[];
        nextCursor: string | null;
      };
      setItems((prev) => [...prev, ...data.items]);
      setNext(data.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [next, loading, categorySlug]);

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
      void fetch(feedUrl(undefined, categorySlug))
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
            setNext(data.nextCursor);
          },
        );
    };
    window.addEventListener(ALICE_FEED_REFRESH, handler);
    return () => window.removeEventListener(ALICE_FEED_REFRESH, handler);
  }, [categorySlug]);

  const empty = !items.length && !next;

  return {
    categorySlug,
    applyCategory,
    items,
    next,
    loading,
    loadMore,
    empty,
    sentinelRef,
  };
}
