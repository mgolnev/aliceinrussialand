"use client";

import type { RefObject } from "react";
import { PostCard } from "./PostCard";
import { FeedPostsSkeleton } from "./FeedPostsSkeleton";
import type { FeedCategory, FeedPost } from "@/types/feed";
import { CategoryFeedContinuation } from "./CategoryFeedContinuation";

type Props = {
  items: FeedPost[];
  next: string | null;
  loading: boolean;
  categoryLoading: boolean;
  loadMore: () => Promise<void>;
  categorySlug: string | null;
  onSelectCategory: (slug: string | null) => void;
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
  categoryLoading,
  loadMore,
  categorySlug,
  onSelectCategory,
  categories,
  plausibleDomain,
  yandexMetrikaId,
  siteUrl,
  canManage = false,
  empty,
  sentinelRef,
}: Props) {
  if (categoryLoading) {
    return <FeedPostsSkeleton />;
  }

  const showCategoryExplore =
    Boolean(categorySlug) && !categoryLoading && !next;

  if (empty) {
    return (
      <div className="min-w-0 space-y-6">
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-12 text-center text-stone-600">
          {categorySlug
            ? "В этой категории пока нет постов."
            : "Пока нет опубликованных постов. Зайдите в админку и создайте первый."}
        </p>
        {showCategoryExplore && categorySlug ? (
          <CategoryFeedContinuation
            key={categorySlug}
            categorySlug={categorySlug}
            onSelectCategory={onSelectCategory}
          />
        ) : null}
      </div>
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
      {showCategoryExplore && categorySlug ? (
        <CategoryFeedContinuation
          key={categorySlug}
          categorySlug={categorySlug}
          onSelectCategory={onSelectCategory}
        />
      ) : null}
    </div>
  );
}
