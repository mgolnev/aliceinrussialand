export type AdminPostListRow = {
  id: string;
  slug: string;
  preview: string;
  status: string;
  publishedAt: string | null;
  updatedAt: string;
  imageCount: number;
  thumbUrl: string | null;
  categoryName: string | null;
};
