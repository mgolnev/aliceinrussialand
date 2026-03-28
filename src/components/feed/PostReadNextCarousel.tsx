"use client";

import Link from "next/link";
import Image, { type ImageLoaderProps } from "next/image";
import { useCallback } from "react";
import type { PostCarouselItem } from "@/types/feed";
import {
  intrinsicSizeForImage,
  pickDefaultVariantUrl,
  pickVariantUrlForRequestedWidth,
} from "@/lib/image-variants";

function CarouselThumb({
  variants,
  alt,
  width,
  height,
}: {
  variants: Record<string, string>;
  alt: string;
  width: number | null;
  height: number | null;
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
      sizes="(max-width: 640px) 72vw, 280px"
      className="h-full w-full object-cover"
      decoding="async"
    />
  );
}

type Props = {
  items: PostCarouselItem[];
};

/** Горизонтальная карусель после поста: обложка и заголовок. */
export function PostReadNextCarousel({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <section
      className="mt-10 border-t border-stone-200/80 pt-8 sm:mt-12 sm:pt-10"
      aria-label="Дальше читайте"
    >
      <div
        className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-3 [scrollbar-width:none] sm:-mx-5 sm:gap-4 sm:px-5 [&::-webkit-scrollbar]:hidden"
        role="list"
      >
        {items.map((item) => {
          const hasImage = Boolean(pickDefaultVariantUrl(item.variants));
          const initial = item.title.trim().slice(0, 1).toUpperCase() || "•";
          return (
            <Link
              key={item.slug}
              href={`/p/${item.slug}`}
              role="listitem"
              className="flex w-[min(280px,calc(100vw-2.75rem))] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white/95 shadow-[0_8px_24px_-12px_rgba(60,44,29,0.2)] outline-none ring-stone-400/30 transition hover:border-stone-300 hover:shadow-md focus-visible:ring-2 active:scale-[0.99] sm:w-[min(300px,calc(100vw-4rem))]"
            >
              <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#f4efe8]">
                {hasImage ? (
                  <CarouselThumb
                    variants={item.variants}
                    alt={item.alt}
                    width={item.width}
                    height={item.height}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200/80 text-3xl font-light text-stone-400">
                    {initial}
                  </div>
                )}
              </div>
              <div className="p-3.5 sm:p-4">
                <span className="line-clamp-3 text-[15px] font-semibold leading-snug text-stone-900 sm:text-base">
                  {item.title}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
