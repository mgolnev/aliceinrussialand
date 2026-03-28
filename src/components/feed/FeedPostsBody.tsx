"use client";

import type { RefObject } from "react";
import { PostCard } from "./PostCard";
import type { FeedCategory, FeedPost } from "@/types/feed";

type Props = {
  items: FeedPost[];
  next: string | null;
  loading: boolean;
  loadMore: () => Promise<void>;
  categorySlug: string | null;
  categories: FeedCategory[];
  plausibleDomain?: string;
  yandexMetrikaId?: string;
  siteUrl: string;
  canManage?: boolean;
  empty: boolean;
  sentinelRef: RefObject<HTMLDivElement | null>;
};

export function FeedPostsBody({
  items,
  next,
  loading,
  loadMore,
  categorySlug,
  categories,
  plausibleDomain,
  yandexMetrikaId,
  siteUrl,
  canManage = false,
  empty,
  sentinelRef,
}: Props) {
  if (empty) {
    return (
      <p className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-12 text-center text-stone-600">
        {categorySlug
          ? "В этой категории пока нет постов."
          : "Пока нет опубликованных постов. Зайдите в админку и создайте первый."}
      </p>
    );
  }

  return (
    <div className="min-w-0 space-y-4 sm:space-y-7">
      {items.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          categories={categories}
          plausibleDomain={plausibleDomain}
          yandexMetrikaId={yandexMetrikaId}
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
