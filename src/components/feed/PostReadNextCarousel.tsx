"use client";

import type { FeedCategory, PostCarouselItem } from "@/types/feed";
import { WatchNextEditorialFlow } from "./WatchNextEditorialFlow";

type Props = {
  items: PostCarouselItem[];
  categories: FeedCategory[];
  /** Категория текущего поста — исключается из чипов «Темы». */
  currentPostCategoryId: string | null;
};

/** Editorial flow после поста: hero + продолжение + темы. */
export function PostReadNextCarousel({
  items,
  categories,
  currentPostCategoryId,
}: Props) {
  if (items.length === 0) return null;

  const featured = items[0] ?? null;
  const continuation = items.slice(1, 5);
  const topics = categories
    .filter((c) => c.id !== currentPostCategoryId)
    .slice(0, 5);

  return (
    <WatchNextEditorialFlow
      featured={featured}
      continuation={continuation}
      topics={topics}
      currentPostCategoryId={currentPostCategoryId}
      sectionHeadingId="post-read-next-heading"
    />
  );
}
