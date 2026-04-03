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

  const featured = data?.featured ? exploreToCarousel(data.featured) : null;
  const continuation: PostCarouselItem[] =
    data?.more.map(exploreToCarousel) ?? [];

  return (
    <WatchNextEditorialFlow
      featured={featured}
      continuation={continuation}
      topics={data?.topics ?? []}
      onSelectCategory={onSelectCategory}
      sectionHeadingId="category-feed-read-next-heading"
      currentPostCategoryId={undefined}
      horizontalArticleFlow
    />
  );
}
