"use client";

import Link from "next/link";
import Image, { type ImageLoaderProps } from "next/image";
import { useMemo, useCallback } from "react";
import type { FeedCategory, PostCarouselItem } from "@/types/feed";
import {
  intrinsicSizeForImage,
  pickDefaultVariantUrl,
  pickVariantUrlForRequestedWidth,
} from "@/lib/image-variants";
import {
  firstSentence as postFirstSentence,
  stripLeadingTitleFromBody,
} from "@/lib/post-title-body-split";
import { LinkPendingBackdrop } from "@/components/ui/LinkPendingBackdrop";

type Props = {
  featured: PostCarouselItem | null;
  continuation: PostCarouselItem[];
  topics: FeedCategory[];
  /** ID текущей категории поста (исключаем из тем). */
  currentPostCategoryId?: string | null;
  /** Если не задано, темы ведут на главную с параметром `category`. */
  onSelectCategory?: (slug: string | null) => void;
  sectionHeadingId: string;
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

function buildHeadingAndText(item: PostCarouselItem) {
  const heading = postFirstSentence(item.title || item.preview || "").trim();
  const rawBody = (item.preview || item.title || "").trim();
  const text = stripLeadingTitleFromBody(rawBody, heading).trim();
  return {
    heading: heading || item.title || "",
    text: text || rawBody || item.title || "",
  };
}

function isPortraitImage(item: PostCarouselItem) {
  const hasImage = Boolean(pickDefaultVariantUrl(item.variants));
  if (!hasImage) return false;
  const w = item.width ?? null;
  const h = item.height ?? null;
  if (!w || !h) return false;
  return h / w >= 1.2;
}

function detectCardKind(item: PostCarouselItem): "hero" | "imageLed" | "textLed" | "visualOnly" | "quoteFragment" {
  const hasImage = Boolean(pickDefaultVariantUrl(item.variants));
  const { text } = buildHeadingAndText(item);
  const trimmed = text.trim();
  const len = trimmed.length;

  if (hasImage && len <= 70) return "visualOnly";
  if (!hasImage) {
    if (len <= 120) return "quoteFragment";
    return "textLed";
  }
  // Если изображение есть, но текст "короткий" и выглядит как заметка — делаем text-led-ощущение.
  if (len <= 160) return "imageLed";
  return "imageLed";
}

function TopicsBlock({
  topics,
  currentPostCategoryId,
  onSelectCategory,
}: {
  topics: FeedCategory[];
  currentPostCategoryId?: string | null;
  onSelectCategory?: (slug: string | null) => void;
}) {
  const filtered = useMemo(() => {
    const c = currentPostCategoryId ?? null;
    return c ? topics.filter((t) => t.id !== c) : topics;
  }, [topics, currentPostCategoryId]);

  if (filtered.length === 0) return null;

  const chipClassName =
    "rounded-full bg-stone-100/70 px-3 py-1.5 text-xs font-medium text-stone-800 ring-1 ring-stone-200/70 transition hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300";

  return (
    <div className="pt-4">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
        Темы
      </div>
      <div className="flex flex-wrap gap-2">
        {filtered.map((c) =>
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
  );
}

function HeroStory({ item }: { item: PostCarouselItem }) {
  const kind = detectCardKind(item);
  const hasImage = Boolean(pickDefaultVariantUrl(item.variants));
  const portrait = isPortraitImage(item);

  const { heading, text } = buildHeadingAndText(item);
  const label = item.categoryName?.trim() || "Без темы";

  return (
    <Link
      href={`/p/${item.slug}`}
      className="group relative block overflow-hidden rounded-3xl bg-[#fffdf9]/90 shadow-[0_18px_50px_-40px_rgba(60,44,29,0.55)] ring-1 ring-stone-200/60"
      aria-label={`Следующая история: ${item.title}`}
    >
      <LinkPendingBackdrop />

      {hasImage ? (
        <div className="relative">
          <ExploreThumb
            variants={item.variants}
            alt={item.alt}
            width={item.width}
            height={item.height}
            sizes="(max-width: 768px) 94vw, 800px"
            className={`w-full object-cover transition duration-300 group-hover:scale-[1.02] ${
              portrait ? "aspect-[3/4]" : "aspect-[4/3]"
            }`}
          />
          {/* Подложка под текст: делает читаемость стабильной на светлых фото */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/78 via-black/35 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 sm:p-5">
            <div className="text-xs font-semibold tracking-wide text-white/90">
              {label}
            </div>
            <div className="mt-1 line-clamp-2 text-lg font-semibold leading-tight text-white">
              {heading}
            </div>
            <div className="mt-2 line-clamp-2 text-sm leading-snug text-white/85">
              {postFirstSentence(text)}
            </div>
          </div>
        </div>
      ) : kind === "quoteFragment" ? (
        <div className="p-4 sm:p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            Продолжить
          </div>
          <div className="mt-2 text-[22px] leading-[1.12] font-semibold text-stone-950">
            “{postFirstSentence(text)}”
          </div>
          <div className="mt-3 text-sm leading-snug text-stone-700">
            {heading}
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-amber-950/70">
            <span className="inline-flex items-center text-[11px] font-medium text-stone-400 transition hover:text-stone-600">
              Открыть пост
            </span>
          </div>
        </div>
      ) : (
        <div className="p-4 sm:p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            Следующая история
          </div>
          <div className="mt-2 text-[22px] leading-[1.12] font-semibold text-stone-950">
            {heading}
          </div>
          <div className="mt-2 line-clamp-3 text-sm leading-snug text-stone-700">
            {postFirstSentence(text)}
          </div>
          <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-amber-950/70">
            <span className="inline-flex items-center text-[11px] font-medium text-stone-400 transition hover:text-stone-600">
              Открыть пост
            </span>
          </div>
        </div>
      )}
    </Link>
  );
}

function StoryCard({
  item,
  index,
}: {
  item: PostCarouselItem;
  index: number;
}) {
  const kind = detectCardKind(item);
  const hasImage = Boolean(pickDefaultVariantUrl(item.variants));
  const portrait = isPortraitImage(item);
  const label = item.categoryName?.trim() || "Без темы";
  const { heading, text } = buildHeadingAndText(item);
  const preview = text.trim();

  // Вариативность размеров: чередуем компоновки, чтобы не выглядело “плиткой”.
  const altSize = index % 2 === 1;

  if (!hasImage && (kind === "quoteFragment" || preview.length <= 140)) {
    return (
      <Link
        href={`/p/${item.slug}`}
        className="group relative block rounded-3xl bg-stone-50/70 px-4 py-4 ring-1 ring-stone-200/70"
        aria-label={`Открыть пост: ${item.title}`}
      >
        <LinkPendingBackdrop />
        <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
          Фрагмент
        </div>
        <div className="mt-2 line-clamp-4 text-lg font-semibold leading-tight text-stone-950">
          “{postFirstSentence(text)}”
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-xs font-semibold text-stone-700">{heading}</div>
          <span className="inline-flex items-center text-[11px] font-medium text-stone-400 transition hover:text-stone-600">
            Открыть пост
          </span>
        </div>
        <div className="mt-2 text-xs font-medium text-stone-500">{label}</div>
      </Link>
    );
  }

  if (hasImage && kind === "visualOnly") {
    return (
      <Link
        href={`/p/${item.slug}`}
        className={`group relative block overflow-hidden rounded-3xl bg-white/70 ring-1 ring-stone-200/70 ${
          altSize ? "p-[1px]" : "p-[1px]"
        }`}
        aria-label={`Открыть визуал: ${item.title}`}
      >
        <LinkPendingBackdrop />
        <div className="relative">
          <ExploreThumb
            variants={item.variants}
            alt={item.alt}
            width={item.width}
            height={item.height}
            sizes="(max-width: 768px) 94vw, 800px"
            className={`w-full object-cover transition duration-300 group-hover:scale-[1.015] ${
              portrait
                ? "aspect-[3/4]"
                : altSize
                  ? "aspect-[5/3]"
                  : "aspect-[4/3]"
            }`}
          />
          {/* Текст снизу, но градиент сильнее для портретов */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4">
            <div className="text-xs font-semibold text-white/90">{label}</div>
            <div className="mt-1 line-clamp-2 text-base font-semibold leading-tight text-white">
              {heading}
            </div>
          </div>
        </div>
      </Link>
    );
  }

  if (!hasImage) {
    return (
      <Link
        href={`/p/${item.slug}`}
        className="group relative block rounded-3xl bg-[#fffdf9]/85 px-4 py-4 ring-1 ring-stone-200/70"
        aria-label={`Открыть заметку: ${item.title}`}
      >
        <LinkPendingBackdrop />
        <div className="flex items-end justify-between gap-3">
          <div className="text-xs font-semibold text-stone-500">{label}</div>
          <span className="inline-flex items-center text-[11px] font-medium text-stone-400 transition hover:text-stone-600">
            Открыть пост
          </span>
        </div>
        <div className="mt-2 text-[20px] font-semibold leading-tight text-stone-950">
          {heading}
        </div>
        <div className="mt-2 line-clamp-3 text-sm leading-snug text-stone-700">
          {postFirstSentence(text)}
        </div>
      </Link>
    );
  }

  // image-led: две вариации — полноширинный “медиа + текст” и более “коллажный” горизонтальный.
  // Для портретных фото делаем вертикальный “gallery card”, чтобы не рубить композицию.
  if (portrait) {
    return (
      <Link
        href={`/p/${item.slug}`}
        className="group block overflow-hidden rounded-3xl bg-white/60 ring-1 ring-stone-200/70"
        aria-label={`Открыть пост: ${item.title}`}
      >
        <LinkPendingBackdrop />
        <div className="relative">
          <ExploreThumb
            variants={item.variants}
            alt={item.alt}
            width={item.width}
            height={item.height}
            sizes="(max-width: 768px) 94vw, 800px"
            className="aspect-[3/4] w-full object-cover transition duration-300 group-hover:scale-[1.01]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
            <div className="text-xs font-semibold text-white/90">{label}</div>
            <div className="mt-1 line-clamp-2 text-base font-semibold leading-tight text-white">
              {heading}
            </div>
            <div className="mt-2 line-clamp-2 text-sm leading-snug text-white/85">
              {postFirstSentence(text)}
            </div>
            <div className="mt-3">
              <span className="inline-flex items-center text-[11px] font-medium text-white/75 transition hover:text-white/90">
                Открыть пост
              </span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return altSize ? (
    <Link
      href={`/p/${item.slug}`}
      className="group block overflow-hidden rounded-3xl bg-white/60 ring-1 ring-stone-200/70"
      aria-label={`Открыть пост: ${item.title}`}
    >
      <LinkPendingBackdrop />
      <div className="flex flex-row gap-0">
        <div className="relative w-5/12 shrink-0 bg-stone-100/40">
          <ExploreThumb
            variants={item.variants}
            alt={item.alt}
            width={item.width}
            height={item.height}
            sizes="(max-width: 768px) 45vw, 320px"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex min-h-[7.25rem] flex-1 flex-col justify-between p-4">
          <div>
            <div className="text-xs font-semibold text-stone-500">{label}</div>
            <div className="mt-1 line-clamp-2 text-base font-semibold leading-tight text-stone-950">
              {heading}
            </div>
            <div className="mt-2 line-clamp-2 text-sm leading-snug text-stone-700">
              {postFirstSentence(text)}
            </div>
          </div>
          <span className="mt-3 inline-flex items-center text-[11px] font-medium text-stone-400 transition hover:text-stone-600">
            Открыть пост
          </span>
        </div>
      </div>
    </Link>
  ) : (
    <Link
      href={`/p/${item.slug}`}
      className="group block overflow-hidden rounded-3xl bg-white/60 ring-1 ring-stone-200/70"
      aria-label={`Открыть пост: ${item.title}`}
    >
      <LinkPendingBackdrop />
      <div className="relative">
        <ExploreThumb
          variants={item.variants}
          alt={item.alt}
          width={item.width}
          height={item.height}
          sizes="(max-width: 768px) 94vw, 800px"
          className="aspect-[16/10] w-full object-cover transition duration-300 group-hover:scale-[1.01]"
        />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 via-black/18 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="text-xs font-semibold text-white/90">{label}</div>
          <div className="mt-1 line-clamp-2 text-base font-semibold leading-tight text-white">
            {heading}
          </div>
          <div className="mt-2 line-clamp-2 text-sm leading-snug text-white/85">
            {postFirstSentence(text)}
          </div>
            <div className="mt-3">
              <span className="inline-flex items-center text-[11px] font-medium text-white/75 transition hover:text-white/90">
                Открыть пост
              </span>
            </div>
        </div>
      </div>
    </Link>
  );
}

export function WatchNextEditorialFlow({
  featured,
  continuation,
  topics,
  currentPostCategoryId,
  onSelectCategory,
  sectionHeadingId,
}: Props) {
  const hasStories = Boolean(featured) || continuation.length > 0;
  if (!hasStories && topics.length === 0) return null;

  return (
    <div className="mt-8 sm:mt-10">
      <div className="px-1">
        <h2
          id={sectionHeadingId}
          className="mb-2 text-base font-semibold leading-tight text-stone-900 sm:mb-3 sm:text-lg"
        >
          Следующая история
        </h2>
        <div className="h-px bg-stone-200/70" />
      </div>

      <section className="mt-4 px-1">
        <div className="space-y-3">
          {featured ? (
            <div>
              <HeroStory item={featured} />
            </div>
          ) : null}

          {continuation.slice(0, 4).map((it, idx) => (
            <StoryCard key={it.slug} item={it} index={idx} />
          ))}
        </div>

        <TopicsBlock
          topics={topics}
          currentPostCategoryId={currentPostCategoryId}
          onSelectCategory={onSelectCategory}
        />
      </section>
    </div>
  );
}

