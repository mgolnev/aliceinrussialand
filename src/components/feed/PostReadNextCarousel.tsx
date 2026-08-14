"use client";

import type { FeedCategory, PostCarouselItem } from "@/types/feed";
import { WatchNextEditorialFlow } from "./WatchNextEditorialFlow";

type Props = {
  items: PostCarouselItem[];
  categories: FeedCategory[];
  /** Категория текущего поста — исключается из чипов «Темы». */
  currentPostCategoryId: string | null;
  /** Slug-и ручных связей: они показываются перед обычными рекомендациями. */
  relatedPostSlugs?: string[];
};

export function splitPostRecommendations(
  items: PostCarouselItem[],
  relatedPostSlugs: string[] = [],
) {
  const relatedSlugs = new Set(relatedPostSlugs);
  const related = items.filter((item) => relatedSlugs.has(item.slug));
  const regular = items.filter((item) => !relatedSlugs.has(item.slug));

  if (related.length === 0) {
    return {
      featured: regular[0] ?? null,
      continuation: regular.slice(1, 5),
    };
  }

  return {
    featured: related[0] ?? null,
    // Сохраняем пять обычных рекомендаций и добавляем к ним все ручные связи.
    continuation: [...related.slice(1), ...regular.slice(0, 5)],
  };
}

/** Editorial flow после поста: hero + продолжение + темы. */
export function PostReadNextCarousel({
  items,
  categories,
  currentPostCategoryId,
  relatedPostSlugs,
}: Props) {
  if (items.length === 0) return null;

  const { featured, continuation } = splitPostRecommendations(items, relatedPostSlugs);
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
      horizontalArticleFlow
    />
  );
}
