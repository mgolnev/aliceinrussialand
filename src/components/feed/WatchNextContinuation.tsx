"use client";

import Link from "next/link";
import Image, { type ImageLoaderProps } from "next/image";
import { useCallback } from "react";
import type { FeedCategory } from "@/types/feed";
import {
  intrinsicSizeForImage,
  pickDefaultVariantUrl,
  pickVariantUrlForRequestedWidth,
} from "@/lib/image-variants";
import { LinkPendingBackdrop } from "@/components/ui/LinkPendingBackdrop";

export type WatchNextCard = {
  slug: string;
  preview: string;
  displayLetter: string;
  categoryName: string;
  variants: Record<string, string>;
  width: number | null;
  height: number | null;
  alt: string;
};

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
  featured: WatchNextCard | null;
  more: WatchNextCard[];
  topics: FeedCategory[];
  /** Лента категории: без полной перезагрузки. На странице поста не передаётся — используются ссылки. */
  onSelectCategory?: (slug: string | null) => void;
  sectionHeadingId: string;
  loading?: boolean;
};

/** Общая вёрстка «Смотреть дальше»: hero 60/40, карусель «Ещё», чипы «Темы». */
export function WatchNextContinuation({
  featured,
  more,
  topics,
  onSelectCategory,
  sectionHeadingId,
  loading = false,
}: Props) {
  if (loading) {
    return (
      <div className="mt-8 sm:mt-10">
        <h2
          id={sectionHeadingId}
          className="mb-2 text-base font-semibold leading-tight text-stone-900 sm:mb-2.5 sm:text-lg"
        >
          Смотреть дальше
        </h2>
        <section
          className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white/50"
          aria-busy="true"
          aria-labelledby={sectionHeadingId}
        >
          <div className="flex h-40 border-b border-stone-200/40 sm:h-44">
            <div className="h-full w-[60%] max-w-[60%] shrink-0 animate-pulse bg-stone-200/60" />
            <div className="flex h-full w-[40%] min-w-[40%] shrink-0 flex-col justify-center gap-2 border-l border-stone-200/30 px-3 py-3 sm:px-3.5">
              <div className="h-2.5 w-full animate-pulse rounded bg-stone-200/70" />
              <div className="h-2.5 w-4/5 animate-pulse rounded bg-stone-200/70" />
              <div className="h-2 w-1/2 animate-pulse rounded bg-stone-200/60" />
            </div>
          </div>
          <div className="px-3 py-4 sm:px-4">
            <div className="h-3 w-24 animate-pulse rounded bg-stone-200/70" />
            <div className="mt-2 flex gap-2 overflow-hidden pt-2">
              <div className="h-28 w-28 shrink-0 animate-pulse rounded-lg bg-stone-200/50" />
              <div className="h-28 w-28 shrink-0 animate-pulse rounded-lg bg-stone-200/50" />
              <div className="h-28 w-28 shrink-0 animate-pulse rounded-lg bg-stone-200/50" />
            </div>
          </div>
        </section>
      </div>
    );
  }

  const hasPosts = Boolean(featured) || more.length > 0;
  const hasTopics = topics.length > 0;
  if (!hasPosts && !hasTopics) return null;

  const chipClassName =
    "rounded-full border border-stone-300/90 bg-white/90 px-3 py-1.5 text-sm font-medium normal-case text-stone-800 shadow-sm transition hover:border-stone-400 hover:bg-white";

  return (
    <div className="mt-8 sm:mt-10">
      <h2
        id={sectionHeadingId}
        className="mb-2 text-base font-semibold leading-tight text-stone-900 sm:mb-2.5 sm:text-lg"
      >
        Смотреть дальше
      </h2>
      <section
        className="overflow-hidden rounded-2xl border border-stone-200/80 bg-[#fffdf9]/90 shadow-[0_12px_40px_-28px_rgba(60,44,29,0.35)]"
        aria-labelledby={sectionHeadingId}
      >
        {featured ? (
          <Link
            href={`/p/${featured.slug}`}
            aria-label={`Продолжить смотреть: ${featured.preview.slice(0, 120)}`}
            className="group relative flex h-40 min-h-0 w-full shrink-0 overflow-hidden rounded-t-2xl border-b border-stone-200/80 bg-white shadow-[0_12px_36px_-18px_rgba(55,42,28,0.45)] outline-none ring-stone-400/30 transition-[box-shadow,background-color,border-color,transform] duration-200 hover:border-stone-300/90 hover:bg-[#fffdfb] hover:shadow-[0_18px_48px_-20px_rgba(55,42,28,0.5)] focus-visible:ring-2 focus-visible:ring-inset motion-safe:active:scale-[0.99] motion-safe:active:bg-stone-50/95 sm:h-44"
          >
            <LinkPendingBackdrop />
            <div className="relative z-[1] h-full w-[60%] max-w-[60%] shrink-0 overflow-hidden bg-[#ede8e0]">
              {pickDefaultVariantUrl(featured.variants) ? (
                <ExploreThumb
                  variants={featured.variants}
                  alt={featured.alt}
                  width={featured.width}
                  height={featured.height}
                  sizes="(max-width: 768px) 60vw, 400px"
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200/80 text-3xl font-light text-stone-400 sm:text-4xl">
                  {featured.displayLetter}
                </span>
              )}
            </div>
            <div className="relative z-[1] flex h-full min-h-0 w-[40%] min-w-[40%] shrink-0 flex-col justify-between gap-2 border-l border-stone-200/60 bg-gradient-to-br from-white via-white to-[#faf7f2] px-3 py-3 sm:gap-2.5 sm:px-3.5 sm:py-3.5">
              <p className="line-clamp-3 min-h-0 text-[13px] font-semibold leading-snug tracking-tight text-stone-900 [overflow-wrap:anywhere] sm:line-clamp-4 sm:text-[14px] sm:leading-snug">
                {featured.preview}
              </p>
              <div className="mt-auto shrink-0 space-y-1.5">
                <p className="text-[11px] normal-case leading-tight text-stone-500 sm:text-xs">
                  {featured.categoryName}
                </p>
                <p className="text-[11px] font-semibold text-amber-950/75 transition group-hover:text-amber-950 sm:text-xs">
                  Смотреть пост →
                </p>
              </div>
            </div>
          </Link>
        ) : null}

        {more.length > 0 ? (
          <div
            className={`px-3 pt-5 sm:px-4 ${hasTopics ? "pb-1" : "pb-5"}`}
          >
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
                    className="relative flex w-[7.25rem] shrink-0 flex-col overflow-hidden rounded-lg border border-stone-200/70 bg-white/95 outline-none ring-stone-400/30 transition hover:border-stone-300 focus-visible:ring-2 motion-safe:active:scale-[0.98] sm:w-[7.75rem]"
                  >
                    <LinkPendingBackdrop />
                    <div className="relative z-[1] aspect-[4/3] w-full overflow-hidden bg-[#f4efe8]">
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
                    <div className="relative z-[1] min-h-0 px-2 py-1.5">
                      <p className="line-clamp-1 text-[11px] font-medium leading-tight text-stone-900 [overflow-wrap:anywhere] sm:text-xs">
                        {item.preview}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] normal-case text-stone-500 sm:text-[11px]">
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
          <div
            className={`px-3 pb-5 sm:px-4 ${featured || more.length > 0 ? "mt-6" : "pt-5"}`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
              Темы
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {topics.map((c) =>
                onSelectCategory ? (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectCategory(c.slug)}
                    className={chipClassName}
                  >
                    {c.name}
                  </button>
                ) : (
                  <Link
                    key={c.id}
                    href={`/?category=${encodeURIComponent(c.slug)}`}
                    scroll={false}
                    className={chipClassName}
                  >
                    {c.name}
                  </Link>
                ),
              )}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
