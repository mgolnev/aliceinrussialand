export type FeedPost = {
  id: string;
  slug: string;
  title: string;
  body: string;
  displayMode: "GRID" | "STACK";
  publishedAt: string | null;
  pinned: boolean;
  images: Array<{
    id: string;
    caption: string;
    alt: string;
    variants: Record<string, string>;
    width: number | null;
    height: number | null;
  }>;
};
