import { headerTrayClass } from "@/lib/pill-tab-styles";

type Variant = "categories" | "back";

/** Плашка под шапкой: как `FeedCategoryBar` или `PostBackTray` при загрузке сегмента. */
export function FeedHeaderTraySkeleton({ variant }: { variant: Variant }) {
  if (variant === "back") {
    return (
      <nav className={headerTrayClass} aria-hidden>
        <div className="h-[38px] w-28 shrink-0 animate-pulse rounded-site-control bg-stone-200/70 sm:w-32" />
      </nav>
    );
  }
  return (
    <nav className={headerTrayClass} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-[38px] w-[4.5rem] shrink-0 animate-pulse rounded-site-control bg-stone-200/65 sm:w-24"
        />
      ))}
    </nav>
  );
}
