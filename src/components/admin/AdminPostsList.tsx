"use client";

import { useEffect, useMemo, useState } from "react";
import type { FeedCategory } from "@/types/feed";
import { AdminPostRow } from "@/components/admin/AdminPostRow";
import type { AdminPostListRow } from "@/components/admin/admin-post-list-types";
import {
  ADMIN_POSTS_SORT_STORAGE_KEY,
  isAdminPostsListSortMode,
  sortAdminPostRows,
  type AdminPostsListSortMode,
} from "@/lib/admin-posts-list-sort";

export type { AdminPostListRow };

const SORT_OPTIONS: { value: AdminPostsListSortMode; label: string }[] = [
  { value: "feed_order", label: "Как в ленте (закреплённые сверху)" },
  { value: "updated_desc", label: "По дате изменения" },
  { value: "published_desc", label: "По дате публикации" },
  { value: "created_desc", label: "По дате создания" },
  { value: "title_asc", label: "По названию (А → Я)" },
];

export function AdminPostsList({
  posts,
  siteUrl,
  categories,
}: {
  posts: AdminPostListRow[];
  siteUrl: string;
  categories: FeedCategory[];
}) {
  const [sortMode, setSortMode] =
    useState<AdminPostsListSortMode>("updated_desc");

  useEffect(() => {
    const raw = window.localStorage.getItem(ADMIN_POSTS_SORT_STORAGE_KEY);
    if (isAdminPostsListSortMode(raw)) setSortMode(raw);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(ADMIN_POSTS_SORT_STORAGE_KEY, sortMode);
  }, [sortMode]);

  const sorted = useMemo(
    () => sortAdminPostRows(posts, sortMode),
    [posts, sortMode],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label
          htmlFor="admin-posts-sort"
          className="text-sm font-medium text-stone-700"
        >
          Порядок списка
        </label>
        <select
          id="admin-posts-sort"
          className="min-w-0 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 shadow-sm outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-400/25 sm:max-w-md"
          value={sortMode}
          onChange={(e) => {
            const v = e.target.value;
            if (isAdminPostsListSortMode(v)) setSortMode(v);
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <ul className="rounded-2xl border border-stone-200/60 bg-white shadow-sm ring-1 ring-stone-100/80">
        {sorted.map((p) => (
          <AdminPostRow
            key={p.id}
            post={p}
            siteUrl={siteUrl}
            categories={categories}
          />
        ))}
      </ul>
    </div>
  );
}
