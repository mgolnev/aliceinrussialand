"use client";

import { useEffect, useState } from "react";
import type {
  CategoryExplorePost,
  CategoryFeedExplorePayload,
  PostCarouselItem,
} from "@/types/feed";
import { WatchNextEditorialFlow } from "./WatchNextEditorialFlow";

type Props = {
  categorySlug: string;
  onSelectCategory: (slug: string | null) => void;
};

function exploreToCarousel(p: CategoryExplorePost): PostCarouselItem {
  return {
    slug: p.slug,
    title: p.title,
    preview: p.preview,
    categoryName: p.categoryName,
    categorySlug: p.categorySlug,
    variants: p.variants ?? {},
    width: p.width,
    height: p.height,
    alt: p.alt,
  };
}

function ReadNextSkeleton() {
  return (
    <div
      className="relative mt-8 animate-pulse sm:mt-10"
      aria-busy
      aria-label="Загрузка рекомендаций"
    >
      <div className="absolute -top-3 left-0 right-0 h-px bg-stone-200/80 sm:-top-4" />
      <div className="px-1 pt-1">
        <div className="h-6 max-w-[11rem] rounded-md bg-stone-200/90" />
        <div className="mt-3 h-px bg-stone-200/70" />
      </div>
      <div className="mt-5 space-y-3 px-1">
        <div className="h-3 max-w-[18rem] rounded bg-stone-100" />
        <div className="h-48 rounded-3xl bg-stone-100 sm:h-56" />
        <div className="h-28 rounded-3xl bg-stone-100" />
        <div className="h-28 rounded-3xl bg-stone-100 sm:hidden" />
      </div>
    </div>
  );
}

export function CategoryFeedContinuation({
  categorySlug,
  onSelectCategory,
}: Props) {
  const [data, setData] = useState<CategoryFeedExplorePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    void fetch(
      `/api/feed/category-explore?category=${encodeURIComponent(categorySlug)}`,
      { cache: "no-store", signal: ac.signal },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((payload: CategoryFeedExplorePayload | null) => {
        if (!ac.signal.aborted) setData(payload);
      })
      .catch(() => {
        if (!ac.signal.aborted) setData(null);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [categorySlug]);

  if (loading) return <ReadNextSkeleton />;
  if (!data) return null;

  const featured = data.featured ? exploreToCarousel(data.featured) : null;
  const continuation: PostCarouselItem[] = data.more.map(exploreToCarousel);
  if (!featured && continuation.length === 0 && data.topics.length === 0) {
    return null;
  }

  return (
    <WatchNextEditorialFlow
      blocks={[
        {
          overline: `Не только «${data.currentCategoryName}»`,
          featured,
          continuation,
        },
      ]}
      topics={data.topics}
      onSelectCategory={onSelectCategory}
      sectionHeadingId="category-feed-read-next-heading"
      intro={null}
      currentPostCategoryId={undefined}
    />
  );
}
