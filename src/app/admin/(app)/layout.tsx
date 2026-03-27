import Link from "next/link";
import { AdminLogout } from "./AdminLogout";

export default function AdminAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fffdf8_0%,#f6f0e8_100%)] text-stone-900">
      <header className="sticky top-0 z-20 border-b border-stone-200/70 bg-[#fffdf9]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-stone-900 text-sm font-semibold text-white shadow-sm">
              AR
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-900">Админка</p>
              <p className="text-xs text-stone-500">Лента и публикации</p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <Link
              href="/admin"
              className="rounded-full border border-stone-200 bg-white px-3 py-2 text-stone-900 shadow-sm"
            >
              Посты
            </Link>
            <Link
              href="/admin/telegram"
              className="rounded-full px-3 py-2 text-stone-600 hover:bg-white hover:text-stone-900"
            >
              Telegram
            </Link>
            <Link
              href="/admin/settings"
              className="rounded-full px-3 py-2 text-stone-600 hover:bg-white hover:text-stone-900"
            >
              Настройки
            </Link>
            <Link
              href="/"
              className="rounded-full px-3 py-2 text-stone-500 hover:bg-white hover:text-stone-800"
            >
              На сайт
            </Link>
          </nav>
          <AdminLogout />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
