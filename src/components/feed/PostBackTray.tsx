"use client";

import { BackToFeedButton } from "./BackToFeedButton";
import { headerTrayClass } from "@/lib/pill-tab-styles";

/** Одна строка в липкой шапке страницы поста — как `FeedCategoryBar` variant="header". */
export function PostBackTray({ title }: { title?: string }) {
  return (
    <nav
      className={headerTrayClass}
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
