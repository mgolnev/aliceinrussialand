"use client";

/** Плейсхолдер ленты при смене рубрики (табы). */
export function FeedPostsSkeleton() {
  return (
    <div
      className="min-w-0 space-y-4 sm:space-y-7"
      aria-busy="true"
    >
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse overflow-hidden rounded-site-surface border border-stone-200/80 bg-white/95"
        >
          <div className="space-y-4 px-3 py-4 sm:px-5 sm:py-5">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-2">
                <div className="h-3.5 w-28 rounded-full bg-stone-200/90" />
                <div className="h-3 w-20 rounded-full bg-stone-100" />
              </div>
              <div className="h-9 w-9 shrink-0 rounded-full bg-stone-100" />
            </div>
            <div className="space-y-2.5">
              <div className="h-3.5 w-full rounded-full bg-stone-100" />
              <div className="h-3.5 w-[92%] rounded-full bg-stone-100" />
              <div className="h-3.5 w-[78%] rounded-full bg-stone-100" />
            </div>
            <div className="aspect-[4/3] w-full rounded-site-media bg-stone-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
