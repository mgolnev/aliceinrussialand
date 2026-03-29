"use client";

import type { FeedCategory, PostCarouselItem } from "@/types/feed";
import {
  WatchNextContinuation,
  type WatchNextCard,
} from "./WatchNextContinuation";

function itemToWatchCard(item: PostCarouselItem): WatchNextCard {
  const letter = item.title.trim().slice(0, 1).toUpperCase() || "•";
  return {
    slug: item.slug,
    preview: item.preview,
    displayLetter: letter,
    categoryName: item.categoryName,
    variants: item.variants,
    width: item.width,
    height: item.height,
    alt: item.alt,
  };
}

type Props = {
  items: PostCarouselItem[];
  categories: FeedCategory[];
  /** Категория текущего поста — исключается из чипов «Темы». */
  currentPostCategoryId: string | null;
};

/** Блок «Смотреть дальше» после поста: та же вёрстка, что в конце категории; подборка — getPostCarouselPeers. */
export function PostReadNextCarousel({
  items,
  categories,
  currentPostCategoryId,
}: Props) {
  if (items.length === 0) return null;

  const featured = itemToWatchCard(items[0]!);
  const more = items.slice(1, 7).map(itemToWatchCard);
  const topics = categories
    .filter((c) => c.id !== currentPostCategoryId)
    .slice(0, 5);

  return (
    <WatchNextContinuation
      featured={featured}
      more={more}
      topics={topics}
      sectionHeadingId="post-read-next-heading"
    />
  );
}
