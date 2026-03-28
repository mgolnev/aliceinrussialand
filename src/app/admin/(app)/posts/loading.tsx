export default function AdminPostsLoading() {
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200/60 bg-white shadow-sm ring-1 ring-stone-100/80">
      <ul className="divide-y divide-stone-200/50" aria-hidden>
        {Array.from({ length: 8 }).map((_, i) => (
          <li
            key={i}
            className="flex items-start gap-3 py-3 pl-3 pr-1 sm:gap-4 sm:py-3.5 sm:pl-4"
          >
            <div className="mt-1 h-11 w-11 shrink-0 animate-pulse rounded-[10px] bg-stone-100" />
            <div className="min-w-0 flex-1 space-y-2 pr-2 pt-1">
              <div className="h-3.5 w-[88%] max-w-md animate-pulse rounded bg-stone-100" />
              <div className="h-3.5 w-[72%] max-w-sm animate-pulse rounded bg-stone-100" />
              <div className="h-2.5 w-20 animate-pulse rounded bg-stone-100/80" />
              <div className="flex items-center gap-1.5 pt-0.5">
                <div className="h-2 w-2 animate-pulse rounded-full bg-stone-200" />
                <div className="h-2.5 w-28 animate-pulse rounded bg-stone-100" />
              </div>
              <div className="h-2.5 w-24 animate-pulse rounded bg-stone-50" />
            </div>
            <div className="min-h-[4.25rem] w-11 shrink-0 animate-pulse border-l border-stone-100 bg-stone-50/60 sm:min-h-[4.5rem] sm:w-12" />
          </li>
        ))}
      </ul>
    </div>
  );
}
