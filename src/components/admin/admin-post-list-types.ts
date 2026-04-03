export type AdminPostListRow = {
  id: string;
  slug: string;
  /** Заголовок поста (для сортировки по названию). */
  title: string;
  preview: string;
  status: string;
  pinned: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  imageCount: number;
  thumbUrl: string | null;
  categoryName: string | null;
};
