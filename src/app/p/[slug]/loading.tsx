import { SiteChrome, SiteFooter } from "@/components/site/SiteChrome";
import { getSiteSettings, parseAvatarUrl } from "@/lib/site";

export default async function PostLoading() {
  const settings = await getSiteSettings();

  return (
    <>
      <SiteChrome
        displayName={settings.displayName}
        tagline={settings.tagline}
        avatarUrl={parseAvatarUrl(settings.avatarMediaPath)}
        contactsLabel={settings.contactsLabel}
      />
      <div className="mx-auto max-w-3xl px-3 py-8 sm:px-5 sm:py-10">
        <nav className="mb-6" aria-hidden>
          <div className="h-4 w-24 animate-pulse rounded bg-stone-200/80" />
        </nav>

        <div
          className="overflow-hidden rounded-[24px] border border-stone-200/80 bg-white/95 shadow-[0_8px_30px_-10px_rgba(60,44,29,0.15)] sm:rounded-[30px]"
          aria-busy="true"
          aria-label="Загрузка поста"
        >
          <div className="flex items-start justify-between gap-3 px-3 pb-3 pt-3 sm:px-5 sm:pb-4 sm:pt-5">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-3 w-28 animate-pulse rounded bg-stone-200/70" />
              <div className="h-3 w-20 animate-pulse rounded bg-stone-200/60" />
            </div>
            <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-stone-200/60" />
          </div>
          <div className="space-y-3 px-3 pb-4 sm:px-5 sm:pb-6">
            <div className="h-3 w-full animate-pulse rounded bg-stone-200/60" />
            <div className="h-3 w-[92%] animate-pulse rounded bg-stone-200/55" />
            <div className="h-3 w-[88%] animate-pulse rounded bg-stone-200/50" />
            <div className="h-3 w-[70%] animate-pulse rounded bg-stone-200/45" />
          </div>
          <div className="px-3 pb-5 sm:px-5 sm:pb-7">
            <div className="aspect-[16/10] w-full animate-pulse rounded-2xl bg-stone-200/50 sm:rounded-[22px]" />
          </div>
        </div>

        <div className="mt-8 sm:mt-10">
          <div className="mb-2 h-5 w-40 animate-pulse rounded bg-stone-200/70 sm:mb-2.5" />
          <div className="overflow-hidden rounded-2xl border border-stone-200/70 bg-[#fffdf9]/90 shadow-sm">
            <div className="flex h-40 border-b border-stone-200/50 sm:h-44">
              <div className="h-full w-[60%] animate-pulse bg-stone-200/50" />
              <div className="flex h-full w-[40%] flex-col justify-center gap-2 border-l border-stone-200/40 px-3 py-3">
                <div className="h-2.5 w-full animate-pulse rounded bg-stone-200/60" />
                <div className="h-2.5 w-4/5 animate-pulse rounded bg-stone-200/55" />
                <div className="h-2 w-1/2 animate-pulse rounded bg-stone-200/50" />
              </div>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-stone-500">
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-stone-400" />
            Загружаем пост…
          </span>
        </p>
      </div>
      <SiteFooter />
    </>
  );
}
