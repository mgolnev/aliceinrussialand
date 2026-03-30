"use client";

import Link from "next/link";
import { LinkPendingBackdrop } from "@/components/ui/LinkPendingBackdrop";

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
      <LinkPendingBackdrop />
    </Link>
  );
}
