"use client";

import type { FeedCategory } from "@/types/feed";
import { pillTabClass } from "@/lib/pill-tab-styles";

type Props = {
  categories: FeedCategory[];
  activeSlug: string | null;
  onSelect: (slug: string | null) => void;
  /** `header` — как AdminFolderNav: без нижнего отступа, внутри липкой шапки */
  variant?: "default" | "header";
};

const navClass = {
  default:
    "mb-4 flex gap-1 overflow-x-auto pb-1 pt-0.5 [scrollbar-width:none] sm:mb-5 sm:gap-1.5 [&::-webkit-scrollbar]:hidden",
  header:
    "flex gap-1 overflow-x-auto pb-0.5 pt-0.5 [scrollbar-width:none] sm:gap-1.5 [&::-webkit-scrollbar]:hidden",
} as const;

export function FeedCategoryBar({
  categories,
  activeSlug,
  onSelect,
  variant = "default",
}: Props) {
  return (
    <nav
      className={navClass[variant]}
      aria-label="Категории ленты"
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeSlug === null}
        className={pillTabClass(activeSlug === null)}
        onClick={() => onSelect(null)}
      >
        Все
      </button>
      {categories.map((c) => (
        <button
          key={c.id}
          type="button"
          role="tab"
          aria-selected={activeSlug === c.slug}
          className={pillTabClass(activeSlug === c.slug)}
          onClick={() => onSelect(c.slug)}
        >
          {c.name}
        </button>
      ))}
    </nav>
  );
}
