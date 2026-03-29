"use client";

import Link from "next/link";
import Image, { type ImageLoaderProps } from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { CategoryFeedExplorePayload } from "@/types/feed";
import {
  intrinsicSizeForImage,
  pickDefaultVariantUrl,
  pickVariantUrlForRequestedWidth,
} from "@/lib/image-variants";

function ExploreThumb({
  variants,
  alt,
  width,
  height,
  sizes,
  className,
}: {
  variants: Record<string, string>;
  alt: string;
  width: number | null;
  height: number | null;
  sizes: string;
  className?: string;
}) {
  const fallback = pickDefaultVariantUrl(variants);
  const { width: iw, height: ih } = intrinsicSizeForImage(width, height);
  const loader = useCallback(
    ({ width: requested }: ImageLoaderProps) =>
      pickVariantUrlForRequestedWidth(variants, requested) ?? fallback!,
    [variants, fallback],
  );
  if (!fallback) return null;
  return (
    <Image
      loader={loader}
      src={fallback}
      alt={alt}
      width={iw}
      height={ih}
      sizes={sizes}
      className={className}
      decoding="async"
    />
  );
}

type Props = {
  categorySlug: string;
  onSelectCategory: (slug: string | null) => void;
};

export function CategoryFeedContinuation({
  categorySlug,
  onSelectCategory,
}: Props) {
  const [data, setData] = useState<CategoryFeedExplorePayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    void fetch(
      `/api/feed/category-explore?category=${encodeURIComponent(categorySlug)}`,
      { cache: "no-store", signal: ac.signal },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((payload: CategoryFeedExplorePayload | null) => {
        if (!ac.signal.aborted) setData(payload);
      })
      .catch(() => {
        if (!ac.signal.aborted) setData(null);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [categorySlug]);

  if (loading) {
    return (
      <section
        className="mt-8 rounded-2xl border border-stone-200/70 bg-white/50 px-3 py-5 sm:mt-10 sm:px-4 sm:py-6"
        aria-busy="true"
        aria-label="Загрузка подборки"
      >
        <div className="h-4 w-48 animate-pulse rounded bg-stone-200/80" />
        <div className="mt-4 h-24 animate-pulse rounded-xl bg-stone-200/60" />
        <div className="mt-5 h-3 w-24 animate-pulse rounded bg-stone-200/70" />
        <div className="mt-2 flex gap-2 overflow-hidden">
          <div className="h-28 w-28 shrink-0 animate-pulse rounded-lg bg-stone-200/50" />
          <div className="h-28 w-28 shrink-0 animate-pulse rounded-lg bg-stone-200/50" />
          <div className="h-28 w-28 shrink-0 animate-pulse rounded-lg bg-stone-200/50" />
        </div>
      </section>
    );
  }

  if (!data) return null;

  const { featured, more, topics } = data;
  const hasPosts = Boolean(featured) || more.length > 0;
  const hasTopics = topics.length > 0;
  if (!hasPosts && !hasTopics) return null;

  return (
    <section
      className="mt-8 rounded-2xl border border-stone-200/80 bg-[#fffdf9]/90 px-3 py-5 shadow-[0_12px_40px_-28px_rgba(60,44,29,0.35)] sm:mt-10 sm:px-4 sm:py-6"
      aria-label="Продолжение после категории"
    >
      <h2 className="text-base font-semibold leading-tight text-stone-900 sm:text-lg">
        Ещё немного вдохновения
      </h2>

      {featured ? (
        <div className="mt-5">
          <Link
            href={`/p/${featured.slug}`}
            className="flex gap-3 rounded-xl border border-stone-200/80 bg-white/90 p-2.5 outline-none ring-stone-400/30 transition hover:border-stone-300 hover:bg-white focus-visible:ring-2 active:scale-[0.99] sm:p-3"
          >
            <div className="relative h-[5.25rem] w-[5.25rem] shrink-0 overflow-hidden rounded-lg bg-[#f4efe8] sm:h-28 sm:w-28">
              {pickDefaultVariantUrl(featured.variants) ? (
                <ExploreThumb
                  variants={featured.variants}
                  alt={featured.alt}
                  width={featured.width}
                  height={featured.height}
                  sizes="112px"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-2xl font-light text-stone-400">
                  {featured.displayLetter}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 py-0.5">
              <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-stone-900 [overflow-wrap:anywhere] sm:text-[15px]">
                {featured.preview}
              </p>
              <p className="mt-1.5 text-xs text-stone-500">{featured.categoryName}</p>
            </div>
          </Link>
        </div>
      ) : null}

      {more.length > 0 ? (
        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Ещё
          </p>
          <div
            className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {more.map((item) => {
              const has = Boolean(pickDefaultVariantUrl(item.variants));
              return (
                <Link
                  key={item.slug}
                  href={`/p/${item.slug}`}
                  className="flex w-[7.25rem] shrink-0 flex-col overflow-hidden rounded-lg border border-stone-200/70 bg-white/95 outline-none ring-stone-400/30 transition hover:border-stone-300 focus-visible:ring-2 active:scale-[0.99] sm:w-[7.75rem]"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#f4efe8]">
                    {has ? (
                      <ExploreThumb
                        variants={item.variants}
                        alt={item.alt}
                        width={item.width}
                        height={item.height}
                        sizes="120px"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-lg font-light text-stone-400">
                        {item.displayLetter}
                      </span>
                    )}
                  </div>
                  <div className="min-h-0 px-2 py-1.5">
                    <p className="line-clamp-1 text-[11px] font-medium leading-tight text-stone-900 [overflow-wrap:anywhere] sm:text-xs">
                      {item.preview}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] text-stone-500 sm:text-[11px]">
                      {item.categoryName}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      {hasTopics ? (
        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Темы
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {topics.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectCategory(c.slug)}
                className="rounded-full border border-stone-300/90 bg-white/90 px-3 py-1.5 text-sm font-medium text-stone-800 shadow-sm transition hover:border-stone-400 hover:bg-white"
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
