/** Скелетоны страниц админки при навигации (RSC). */

export function AdminGenericPageSkeleton() {
  return (
    <div
      className="space-y-6"
      aria-busy="true"
      aria-label="Загрузка раздела"
    >
      <div className="space-y-2">
        <div className="h-8 w-64 max-w-full animate-pulse rounded-lg bg-stone-200/80 sm:h-9 sm:w-80" />
        <div className="h-4 w-full max-w-2xl animate-pulse rounded bg-stone-200/50" />
        <div className="h-4 w-[88%] max-w-xl animate-pulse rounded bg-stone-200/40" />
      </div>

      <div className="overflow-hidden rounded-[28px] border border-stone-200/80 bg-white/90 p-5 shadow-[0_20px_50px_-40px_rgba(60,44,29,0.2)] sm:p-6">
        <div className="space-y-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-3.5 w-28 animate-pulse rounded bg-stone-200/75" />
              <div className="h-11 w-full animate-pulse rounded-xl bg-stone-100" />
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-sm text-stone-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-stone-400" />
          Загружаем раздел…
        </span>
      </p>
    </div>
  );
}

/** Как `PostMetaEditor`: max-w-lg, карточки и поля. */
export function AdminPostMetaEditSkeleton() {
  return (
    <div
      className="mx-auto max-w-lg space-y-4"
      aria-busy="true"
      aria-label="Загрузка редактора SEO"
    >
      <div className="rounded-2xl border border-stone-200/80 bg-white/90 px-4 py-4 shadow-sm sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="h-6 w-28 animate-pulse rounded-full bg-stone-200/70" />
          <div className="h-3 w-16 animate-pulse rounded bg-stone-200/50" />
        </div>
        <div className="mt-3 h-7 w-40 animate-pulse rounded-lg bg-stone-200/80 sm:h-8 sm:w-48" />
        <div className="mt-2 space-y-2">
          <div className="h-3.5 w-full animate-pulse rounded bg-stone-200/45" />
          <div className="h-3.5 w-[94%] animate-pulse rounded bg-stone-200/40" />
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-stone-200/80 bg-white/90 px-4 py-4 shadow-sm sm:px-5 sm:py-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <div className="h-3.5 w-32 animate-pulse rounded bg-stone-200/70" />
            <div
              className={`w-full animate-pulse rounded-xl bg-stone-100 ${
                i === 2 ? "min-h-[100px]" : "h-11"
              }`}
            />
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          <div className="h-10 w-28 animate-pulse rounded-full bg-stone-200/70" />
          <div className="h-10 w-32 animate-pulse rounded-full bg-stone-200/55" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-stone-200/80 bg-white/90 px-4 py-4 shadow-sm sm:px-5">
        <div className="h-10 w-40 animate-pulse rounded-full bg-stone-100" />
        <div className="h-10 w-44 animate-pulse rounded-full bg-stone-100" />
      </div>

      <p className="text-center text-sm text-stone-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-stone-400" />
          Загружаем редактор…
        </span>
      </p>
    </div>
  );
}
