"use client";

import type { FeedCategory } from "@/types/feed";
import { AdminPostRow } from "@/components/admin/AdminPostRow";
import type { AdminPostListRow } from "@/components/admin/admin-post-list-types";

export type { AdminPostListRow };

export function AdminPostsList({
  posts,
  siteUrl,
  categories,
}: {
  posts: AdminPostListRow[];
  siteUrl: string;
  categories: FeedCategory[];
}) {
  return (
    <ul className="rounded-2xl border border-stone-200/60 bg-white shadow-sm ring-1 ring-stone-100/80">
      {posts.map((p) => (
        <AdminPostRow
          key={p.id}
          post={p}
          siteUrl={siteUrl}
          categories={categories}
        />
      ))}
    </ul>
  );
}
