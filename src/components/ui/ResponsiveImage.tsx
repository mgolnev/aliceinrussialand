type Variants = Record<string, string>;

type Props = {
  variants: Variants;
  alt: string;
  className?: string;
  priority?: boolean;
  caption?: string;
};

export function ResponsiveImage({
  variants,
  alt,
  className = "",
  priority = false,
  caption,
}: Props) {
  const w640 = variants.w640;
  const w960 = variants.w960;
  const w1280 = variants.w1280;
  const fallback = w1280 ?? w960 ?? w640;
  if (!fallback) return null;

  return (
    <figure className="min-w-0 space-y-2">
      <picture>
        {w1280 ? (
          <source
            type="image/webp"
            media="(min-width: 1100px)"
            srcSet={w1280}
          />
        ) : null}
        {w960 ? (
          <source
            type="image/webp"
            media="(min-width: 640px)"
            srcSet={w960}
          />
        ) : null}
        <img
          src={w640 ?? w960 ?? w1280}
          alt={alt}
          className={`max-w-full min-w-0 w-full rounded-[22px] bg-[#f4efe8] object-contain shadow-[0_14px_34px_-26px_rgba(64,48,32,0.45)] ring-1 ring-stone-200/70 ${className}`}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          sizes="(max-width: 640px) 100vw, (max-width: 1100px) 92vw, 720px"
        />
      </picture>
      {caption ? (
        <figcaption className="px-1 text-sm leading-relaxed text-stone-500">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
