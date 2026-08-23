"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { PostCard } from "./PostCard";
import type { FeedCategory, FeedPost } from "@/types/feed";

type Props = {
  projectSlug: string;
  initialItems: FeedPost[];
  initialNextPage: number | null;
  categories: FeedCategory[];
  plausibleDomain?: string;
  yandexMetrikaId?: string;
  siteUrl: string;
  canManage: boolean;
};

type ProjectFeedResponse = {
  items: FeedPost[];
  nextPage: number | null;
};

function nextPageHref(projectSlug: string, page: number): string {
  return `/projects/${encodeURIComponent(projectSlug)}?page=${page}`;
}

/**
 * Пользователь видит непрерывную ленту. При этом запасная ссылка ведёт на
 * серверную `?page=N`: её увидят браузеры без JavaScript и поисковые роботы.
 */
export function ProjectPostsFeed({
  projectSlug,
  initialItems,
  initialNextPage,
  categories,
  plausibleDomain,
  yandexMetrikaId,
  siteUrl,
  canManage,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [nextPage, setNextPage] = useState(initialNextPage);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const nextPageRef = useRef(initialNextPage);

  useEffect(() => {
    setItems(initialItems);
    setNextPage(initialNextPage);
    nextPageRef.current = initialNextPage;
    setLoadError(false);
  }, [initialItems, initialNextPage]);

  const loadMore = useCallback(async () => {
    const page = nextPageRef.current;
    if (!page || loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    setLoadError(false);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectSlug)}/posts?page=${page}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Unable to load project posts");
      const payload = (await response.json()) as ProjectFeedResponse;
      const incoming = Array.isArray(payload.items) ? payload.items : [];
      setItems((current) => {
        const seen = new Set(current.map((post) => post.id));
        return [...current, ...incoming.filter((post) => !seen.has(post.id))];
      });
      const followingPage =
        typeof payload.nextPage === "number" && payload.nextPage > page
          ? payload.nextPage
          : null;
      nextPageRef.current = followingPage;
      setNextPage(followingPage);
    } catch {
      setLoadError(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [projectSlug]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !nextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMore();
        }
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, nextPage]);

  return (
    <section className="space-y-4 sm:space-y-7" aria-label="Публикации подборки">
      {items.map((post, index) => (
        <PostCard
          key={post.id}
          post={post}
          categories={categories}
          plausibleDomain={plausibleDomain}
          yandexMetrikaId={yandexMetrikaId}
          siteUrl={siteUrl}
          canManage={canManage}
          prioritizeMedia={index === 0}
        />
      ))}
      <div ref={sentinelRef} aria-hidden />
      {nextPage ? (
        <div className="flex flex-col items-center gap-2 pb-8">
          <Link
            href={nextPageHref(projectSlug, nextPage)}
            prefetch={false}
            onClick={(event) => {
              if (
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return;
              }
              event.preventDefault();
              void loadMore();
            }}
            aria-busy={loading}
            className="rounded-full border border-stone-300 bg-white/90 px-6 py-2.5 text-sm font-medium text-stone-800 transition hover:border-stone-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-500"
          >
            <span className="inline-flex items-center justify-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              Показать ещё
            </span>
          </Link>
          {loadError ? (
            <p className="text-xs text-stone-500" role="status">
              Не удалось догрузить записи. Попробуйте ещё раз.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
