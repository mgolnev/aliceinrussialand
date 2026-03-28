"use client";

import Image, { type ImageLoaderProps } from "next/image";
import { useCallback } from "react";
import {
  intrinsicSizeForImage,
  pickDefaultVariantUrl,
  pickVariantUrlForRequestedWidth,
} from "@/lib/image-variants";

type Variants = Record<string, string>;

type Props = {
  variants: Variants;
  alt: string;
  className?: string;
  priority?: boolean;
  caption?: string;
  /** Натуральные размеры оригинала — для aspect ratio и layout next/image */
  width?: number | null;
  height?: number | null;
};

/**
 * Превью в ленте: пресеты WebP на CDN/локально.
 * Кастомный `loader` подставляет w640/w960/w1280 по запросу оптимизатора Next (`sizes` + DPR).
 * Домены Storage — `next.config` → `images.remotePatterns`.
 */
export function ResponsiveImage({
  variants,
  alt,
  className = "",
  priority = false,
  caption,
  width,
  height,
}: Props) {
  const fallback = pickDefaultVariantUrl(variants);
  if (!fallback) return null;

  const { width: iw, height: ih } = intrinsicSizeForImage(width, height);

  const loader = useCallback(
    ({ width: requested }: ImageLoaderProps) =>
      pickVariantUrlForRequestedWidth(variants, requested) ?? fallback,
    [variants, fallback],
  );

  return (
    <figure className="min-w-0 space-y-2">
      <Image
        loader={loader}
        src={fallback}
        alt={alt}
        width={iw}
        height={ih}
        sizes="(max-width: 640px) 100vw, (max-width: 1100px) 92vw, 720px"
        className={`max-w-full min-w-0 h-auto w-full rounded-[22px] bg-[#f4efe8] object-contain shadow-[0_14px_34px_-26px_rgba(64,48,32,0.45)] ring-1 ring-stone-200/70 ${className}`}
        priority={priority}
        decoding="async"
      />
      {caption ? (
        <figcaption className="px-1 text-sm leading-relaxed text-stone-500">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
