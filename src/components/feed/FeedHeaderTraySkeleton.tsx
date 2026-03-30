const trayNavClass =
  "flex gap-1 overflow-x-auto pb-0.5 pt-0.5 [scrollbar-width:none] sm:gap-1.5 [&::-webkit-scrollbar]:hidden";

type Variant = "categories" | "back";

/** Плашка под шапкой: как `FeedCategoryBar` или `PostBackTray` при загрузке сегмента. */
export function FeedHeaderTraySkeleton({ variant }: { variant: Variant }) {
  if (variant === "back") {
    return (
      <nav className={trayNavClass} aria-hidden>
        <div className="h-9 w-28 shrink-0 animate-pulse rounded-xl bg-stone-200/70 sm:w-32" />
      </nav>
    );
  }
  return (
    <nav className={trayNavClass} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-9 w-[4.5rem] shrink-0 animate-pulse rounded-xl bg-stone-200/65 sm:w-24"
        />
      ))}
    </nav>
  );
}
