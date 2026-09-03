"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { chromePlaqueButtonClass } from "@/lib/pill-tab-styles";
import { LinkPendingBackdrop } from "@/components/ui/LinkPendingBackdrop";
import {
  removeFeedBackNavigationFromStorage,
  removeRestoreInFlightFromStorage,
} from "@/lib/feed-scroll";
import { clearNavigationState } from "@/lib/navigation-state";
import { siteFrameClass } from "@/lib/site-layout-styles";

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
  const [homeNoticeVisible, setHomeNoticeVisible] = useState(false);
  const homeNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showHomeNotice = pathname === "/" && homeNoticeVisible;

  useEffect(() => () => {
    if (homeNoticeTimer.current !== null) clearTimeout(homeNoticeTimer.current);
  }, []);

  const onHomeTap = (event: { preventDefault: () => void }) => {
    if (pathname === "/") {
      event.preventDefault();
      if (homeNoticeTimer.current !== null) clearTimeout(homeNoticeTimer.current);
      setHomeNoticeVisible(true);
      // Первый показ: 200 мс на затухание + 200 мс на появление, затем 2 секунды текста.
      homeNoticeTimer.current = setTimeout(() => {
        setHomeNoticeVisible(false);
        homeNoticeTimer.current = null;
      }, homeNoticeVisible ? 2000 : 2400);
      return;
    }

    // Очищаем старое состояние ленты
    removeFeedBackNavigationFromStorage();
    removeRestoreInFlightFromStorage();
    // Очищаем новое состояние навигации
    clearNavigationState();
  };

  // Без общего div-обёртки: у sticky ограничивающий блок — родитель. Короткая обёртка только под шапку+спейсер
  // ломала sticky (шапка уезжала с блоком). Fragment не создаёт узла — родитель тот же, что у ленты ниже.
  // Не использовать display:contents на обёртке (SSR/гидрация Next 16).
  return (
    <>
    <header
      id="site-chrome-root"
      className="sticky top-0 z-20 w-full min-w-0 border-b border-stone-200/70 bg-[#fbfaf7]/90 backdrop-blur-xl"
    >
      <div className={`${siteFrameClass} flex items-center gap-3 py-3 sm:gap-4`}>
        <Link
          href="/"
          prefetch
          scroll={false}
          onNavigate={onHomeTap}
          aria-label={`${displayName} — на главную`}
          className="group relative flex min-w-0 flex-1 items-center gap-3 transition-transform active:scale-[0.98]"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- внешний Supabase / произвольный origin
            <img
              src={avatarUrl}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-stone-200/80 group-hover:ring-stone-300"
            />
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-900 text-white group-hover:bg-stone-800">
              <span className="text-sm font-bold uppercase tracking-tighter">
                {displayName.slice(0, 2)}
              </span>
            </div>
          )}
          <div className="relative min-w-0 flex-1">
            <div
              aria-hidden={showHomeNotice}
              className={`transition-opacity duration-200 motion-reduce:transition-none ${showHomeNotice ? "opacity-0" : "opacity-100 delay-200"}`}
            >
              <p className="truncate text-lg font-bold tracking-tight text-stone-900 sm:text-xl">
                {displayName}
              </p>
              {tagline ? (
                <p className="truncate text-xs text-stone-500 sm:text-sm">{tagline}</p>
              ) : null}
            </div>
            <div
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 flex items-center transition-opacity duration-200 motion-reduce:transition-none ${showHomeNotice ? "opacity-100 delay-200" : "opacity-0"}`}
            >
              <p className="truncate text-lg font-bold tracking-tight text-stone-900 sm:text-xl">
                Вы уже на главной
              </p>
            </div>
          </div>
          <LinkPendingBackdrop />
        </Link>
        <span role="status" className="sr-only">
          {showHomeNotice ? "Вы уже на главной" : ""}
        </span>

        {isAboutPage ? (
          <Link
            href="/"
            prefetch
            scroll={false}
            onNavigate={onHomeTap}
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
        <div className={`${siteFrameClass} pb-2.5 pt-0`}>
          {stickyTray}
        </div>
      ) : null}
    </header>
    <div
      id="site-chrome-spacer"
      aria-hidden
      className="pointer-events-none shrink-0"
      style={{ height: "var(--site-chrome-spacer-h, 0px)" }}
    />
    </>
  );
}
