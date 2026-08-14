"use client";

import { BackToFeedButton } from "./BackToFeedButton";

/** Одна строка в липкой шапке страницы поста — как `FeedCategoryBar` variant="header". */
export function PostBackTray({ title }: { title?: string }) {
  return (
    <nav
      className="relative flex h-9 items-center gap-1 overflow-x-auto [scrollbar-width:none] sm:gap-1.5 [&::-webkit-scrollbar]:hidden"
      aria-label="Навигация по посту"
    >
      <BackToFeedButton variant="pill" />
      {title ? (
        <h1 className="pointer-events-none absolute left-1/2 max-w-[calc(100%-9rem)] -translate-x-1/2 truncate text-center text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">
          {title}
        </h1>
      ) : null}
    </nav>
  );
}
