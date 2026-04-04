"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { chromePlaqueButtonClass } from "@/lib/pill-tab-styles";
import { LinkPendingBackdrop } from "@/components/ui/LinkPendingBackdrop";
import {
  removeFeedBackNavigationFromStorage,
  removeRestoreInFlightFromStorage,
} from "@/lib/feed-scroll";
import { clearNavigationState } from "@/lib/navigation-state";

type Props = {
  displayName: string;
  tagline: string;
  /** Публичный URL превью аватарки (WebP), иначе — инициалы из displayName */
  avatarUrl?: string | null;
  /** Подпись ссылки на /about (SiteSettings.contactsLabel) */
  contactsLabel?: string;
  /** Вторая строка внутри той же липкой шапки (как папки в админке) */
  stickyTray?: ReactNode;
};

export function SiteChrome({
  displayName,
  tagline,
  avatarUrl,
  contactsLabel = "Контакты",
  stickyTray,
}: Props) {
  const pathname = usePathname();
  const isAboutPage = pathname === "/about";
  const onHomeTap = () => {
    // Очищаем старое состояние ленты
    removeFeedBackNavigationFromStorage();
    removeRestoreInFlightFromStorage();
    // Очищаем новое состояние навигации
    clearNavigationState();
  };

  return (
    <>
    <header
      data-site-chrome-root
      className="sticky top-0 z-20 border-b border-stone-200/70 bg-[#fbfaf7]/90 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-3 py-3 sm:gap-4 sm:px-5">
        <Link
          href="/"
          prefetch
          scroll={false}
          onClick={onHomeTap}
          className="group relative flex min-w-0 flex-1 items-center gap-3 transition-transform active:scale-[0.98]"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- внешний Supabase / произвольный origin
            <img
              src={avatarUrl}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-full object-cover shadow-sm ring-1 ring-stone-200/80 group-hover:ring-stone-300"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-900 text-white shadow-sm group-hover:bg-stone-800">
              <span className="text-sm font-bold uppercase tracking-tighter">
                {displayName.slice(0, 2)}
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold tracking-tight text-stone-900 sm:text-xl">
              {displayName}
            </h1>
            {tagline ? (
              <p className="truncate text-xs text-stone-500 sm:text-sm">{tagline}</p>
            ) : null}
          </div>
          <LinkPendingBackdrop />
        </Link>

        {isAboutPage ? (
          <Link
            href="/"
            prefetch
            scroll={false}
            onClick={onHomeTap}
            className={`relative ${chromePlaqueButtonClass()}`}
            aria-label="К ленте работ"
          >
            К ленте
            <LinkPendingBackdrop />
          </Link>
        ) : (
          <Link
            href="/about"
            className={`relative ${chromePlaqueButtonClass()}`}
            aria-label={contactsLabel.trim() || "Контакты"}
          >
            {contactsLabel.trim() || "Контакты"}
            <LinkPendingBackdrop />
          </Link>
        )}
      </div>
      {stickyTray != null ? (
        <div className="mx-auto max-w-3xl px-3 pb-2.5 pt-0 sm:px-5">
          {stickyTray}
        </div>
      ) : null}
    </header>
    {/**
     * Резерв высоты под шапку, пока она временно position:fixed (см. .lightbox-open в globals.css).
     * Без спейсера контент подпрыгивает, когда лайтбокс снимает sticky.
     */}
    <div
      data-site-chrome-spacer
      aria-hidden
      className="pointer-events-none shrink-0"
      style={{ height: "var(--site-chrome-spacer-h, 0px)" }}
    />
    </>
  );
}
