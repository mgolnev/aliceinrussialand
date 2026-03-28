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
  variants: Record<string, string>;
  width: number | null;
  height: number | null;
  alt: string;
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
