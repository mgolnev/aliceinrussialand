"use client";

import { BackToFeedButton } from "./BackToFeedButton";

/** Одна строка в липкой шапке страницы поста — как `FeedCategoryBar` variant="header". */
export function PostBackTray() {
  return (
    <nav
      className="flex gap-1 overflow-x-auto pb-0.5 pt-0.5 [scrollbar-width:none] sm:gap-1.5 [&::-webkit-scrollbar]:hidden"
      aria-label="Навигация по посту"
    >
      <BackToFeedButton variant="pill" />
    </nav>
  );
}
