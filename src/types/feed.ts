export type FeedCategory = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
};

/** Превью для карусели «дальше читайте» на странице поста. */
export type PostCarouselItem = {
  slug: string;
  title: string;
  preview: string;
  categoryName: string;
  categorySlug: string;
  variants: Record<string, string>;
  width: number | null;
  height: number | null;
  alt: string;
};

/** Два слоя рекомендаций на странице поста: своя рубрика и «открытие» соседних/ленты. */
export type PostReadNextPayload = {
  inCategory: PostCarouselItem[];
  beyond: PostCarouselItem[];
};

/** Карточка в блоке «ещё вдохновения» в конце категории. */
export type CategoryExplorePost = {
  slug: string;
  title: string;
  preview: string;
  displayLetter: string;
  categoryName: string;
  categorySlug: string;
  variants: Record<string, string>;
  width: number | null;
  height: number | null;
  alt: string;
};

export type CategoryFeedExplorePayload = {
  currentCategoryName: string;
  currentCategorySlug: string;
  featured: CategoryExplorePost | null;
  more: CategoryExplorePost[];
  topics: FeedCategory[];
};

export type FeedPost = {
  id: string;
  slug: string;
  title: string;
  body: string;
  displayMode: "GRID" | "STACK";
  publishedAt: string | null;
  pinned: boolean;
  categoryId: string | null;
  category: { id: string; name: string; slug: string } | null;
  images: Array<{
    id: string;
    caption: string;
    alt: string;
    variants: Record<string, string>;
    width: number | null;
    height: number | null;
  }>;
};
