import { describe, expect, it } from "vitest";
import type { PostCarouselItem } from "@/types/feed";
import { splitPostRecommendations } from "./PostReadNextCarousel";

function item(slug: string): PostCarouselItem {
  return {
    slug,
    title: slug,
    preview: slug,
    categoryName: "Тема",
    categorySlug: "theme",
    variants: {},
    width: null,
    height: null,
    alt: slug,
  };
}

describe("splitPostRecommendations", () => {
  it("показывает все ручные связи сверх пяти обычных рекомендаций", () => {
    const related = ["related-1", "related-2", "related-3", "related-4"];
    const regular = ["regular-1", "regular-2", "regular-3", "regular-4", "regular-5"];
    const result = splitPostRecommendations(
      [...related, ...regular].map(item),
      related,
    );

    expect(result.featured?.slug).toBe("related-1");
    expect(result.continuation.map((post) => post.slug)).toEqual([
      "related-2",
      "related-3",
      "related-4",
      ...regular,
    ]);
  });

  it("без ручных связей сохраняет обычный лимит в пять карточек", () => {
    const result = splitPostRecommendations(
      ["one", "two", "three", "four", "five", "six"].map(item),
    );

    expect(result.featured?.slug).toBe("one");
    expect(result.continuation.map((post) => post.slug)).toEqual([
      "two",
      "three",
      "four",
      "five",
    ]);
  });
});
