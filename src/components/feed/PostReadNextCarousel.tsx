"use client";

import type { FeedCategory, PostCarouselItem } from "@/types/feed";
import { WatchNextEditorialFlow } from "./WatchNextEditorialFlow";

type Props = {
  inCategory: PostCarouselItem[];
  beyond: PostCarouselItem[];
  categoryLabel: string | null;
  categories: FeedCategory[];
  /** Категория текущего поста — исключается из чипов «Темы». */
  currentPostCategoryId: string | null;
};

/** Два слоя после поста: рубрика материала и отдельный пул «соседи + лента». */
export function PostReadNextCarousel({
  inCategory,
  beyond,
  categoryLabel,
  categories,
  currentPostCategoryId,
}: Props) {
  if (inCategory.length === 0 && beyond.length === 0) return null;

  const topics = categories
    .filter((c) => c.id !== currentPostCategoryId)
    .slice(0, 5);

  const blocks = [];

  if (inCategory.length > 0) {
    blocks.push({
      overline: categoryLabel
        ? `Ещё в «${categoryLabel}»`
        : "Ещё в ленте",
      featured: inCategory[0] ?? null,
      continuation: inCategory.slice(1, 6),
    });
  }

  if (beyond.length > 0) {
    blocks.push({
      overline:
        inCategory.length > 0
          ? "Другие темы"
          : "Ещё из ленты",
      featured: beyond[0] ?? null,
      continuation: beyond.slice(1, 6),
    });
  }

  return (
    <WatchNextEditorialFlow
      blocks={blocks}
      topics={topics}
      currentPostCategoryId={currentPostCategoryId}
      sectionHeadingId="post-read-next-heading"
    />
  );
}
