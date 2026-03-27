"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PostCard } from "./PostCard";
import type { FeedPost } from "@/types/feed";

type Props = {
  initialItems: FeedPost[];
  initialNext: string | null;
  plausibleDomain?: string;
  siteUrl: string;
  canManage?: boolean;
};

export function FeedClient({
  initialItems,
  initialNext,
  plausibleDomain,
  siteUrl,
  canManage = false,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [next, setNext] = useState(initialNext);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (!next || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/feed?cursor=${encodeURIComponent(next)}`);
      const data = (await res.json()) as {
        items: FeedPost[];
        nextCursor: string | null;
      };
      setItems((prev) => [...prev, ...data.items]);
      setNext(data.nextCursor);
    } finally {
      setLoading(false);
    }
  }, [next, loading]);

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

  if (!items.length && !next) {
    return (
      <p className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-12 text-center text-stone-600">
        Пока нет опубликованных постов. Зайдите в админку и создайте первый.
      </p>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-7">
      {items.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          plausibleDomain={plausibleDomain}
          siteUrl={siteUrl}
          canManage={canManage}
        />
      ))}
      <div ref={sentinelRef} />
      {next ? (
        <div className="flex justify-center pb-8">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loading}
            className="rounded-full border border-stone-300 bg-white/90 px-6 py-2.5 text-sm font-medium text-stone-800 shadow-sm transition hover:border-stone-400 disabled:opacity-60"
          >
            {loading ? "Подгружаем…" : "Показать ещё"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
