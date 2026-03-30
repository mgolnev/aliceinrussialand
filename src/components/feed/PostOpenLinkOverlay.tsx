"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";

/** Полупрозрачный слой, пока идёт клиентский переход по родительскому `<Link>`. */
export function LinkNavigatePendingBackdrop() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      className="pointer-events-none absolute inset-0 z-[5] rounded-[inherit] bg-stone-200/40 motion-safe:animate-pulse"
      aria-hidden
    />
  );
}

/**
 * Полноразмерная ссылка на пост в ленте: тап по карточке (кроме меню и превью с lightbox)
 * + визуальный отклик и индикация загрузки перехода.
 */
export function PostOpenLinkOverlay({
  href,
  ariaLabel,
}: {
  href: string;
  ariaLabel: string;
}) {
  return (
    <Link
      href={href}
      prefetch
      aria-label={ariaLabel}
      className="absolute inset-0 z-0 rounded-[24px] motion-safe:transition-colors motion-safe:duration-150 motion-safe:active:bg-stone-900/[0.06] sm:rounded-[30px]"
    >
      <LinkNavigatePendingBackdrop />
    </Link>
  );
}
