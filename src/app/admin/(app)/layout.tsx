import Link from "next/link";
import type { Viewport } from "next";
import { connection } from "next/server";
import { getSiteSettings, parseAvatarUrl } from "@/lib/site";
import { AdminFolderNav } from "@/components/admin/AdminFolderNav";

export const dynamic = "force-dynamic";

/** Без pinch-zoom: меньше горизонтального скролла и сдвигов на мобильных */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function AdminAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  /** `getSiteSettings` в `@/lib/site` обёрнут в `React.cache` — повторные вызовы в том же запросе без лишнего SQL. */
  const settings = await getSiteSettings();
  const avatarUrl = parseAvatarUrl(settings.avatarMediaPath);
  const initials = settings.displayName.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#fffdf8_0%,#f6f0e8_100%)] text-stone-900">
      <header className="sticky top-0 z-20 border-b border-stone-200/70 bg-[#fffdf9]/92 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-3 pt-3 sm:px-6 sm:pt-4">
          <div className="flex min-w-0 items-center justify-between gap-3 pb-2">
            <div className="flex min-w-0 items-center gap-3">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 shrink-0 rounded-full object-cover shadow-sm ring-1 ring-stone-200/80"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-bold uppercase tracking-tighter text-white shadow-sm">
                  {initials}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-lg font-bold tracking-tight text-stone-900 sm:text-xl">
                  Админка
                </p>
                <p className="truncate text-xs text-stone-500 sm:text-sm">
                  только то, чего нет в ленте
                </p>
              </div>
            </div>
            <Link
              href="/"
              className="shrink-0 rounded-full border border-stone-200 bg-white px-3 py-2 text-[13px] font-semibold text-stone-800 shadow-sm transition-colors hover:border-stone-300 hover:bg-stone-50 active:scale-[0.98] sm:px-4 sm:text-sm"
            >
              На сайт
            </Link>
          </div>
          <div className="pb-2.5 pt-0">
            <AdminFolderNav />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-3 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
