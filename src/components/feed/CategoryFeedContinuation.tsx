"use client";

import { useEffect, useState } from "react";
import type {
  CategoryExplorePost,
  CategoryFeedExplorePayload,
} from "@/types/feed";
import { WatchNextContinuation, type WatchNextCard } from "./WatchNextContinuation";

type Props = {
  categorySlug: string;
  onSelectCategory: (slug: string | null) => void;
};

function exploreToWatch(p: CategoryExplorePost): WatchNextCard {
  return {
    slug: p.slug,
    preview: p.preview,
    displayLetter: p.displayLetter,
    categoryName: p.categoryName,
    variants: p.variants,
    width: p.width,
    height: p.height,
    alt: p.alt,
  };
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

  if (!loading && !data) return null;

  const featured = data?.featured ? exploreToWatch(data.featured) : null;
  const more: WatchNextCard[] = data?.more.map(exploreToWatch) ?? [];

  return (
    <WatchNextContinuation
      featured={featured}
      more={more}
      topics={data?.topics ?? []}
      onSelectCategory={onSelectCategory}
      sectionHeadingId="category-feed-continuation-heading"
      loading={loading}
    />
  );
}
