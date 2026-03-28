"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { pillTabClass } from "@/lib/pill-tab-styles";

export function AdminFolderNav() {
  const pathname = usePathname() || "";

  const postsActive = pathname.startsWith("/admin/posts");
  const telegramActive = pathname.startsWith("/admin/telegram");
  const settingsActive = pathname.startsWith("/admin/settings");
  const categoriesActive = pathname.startsWith("/admin/categories");

  return (
    <nav
      className="flex gap-1 overflow-x-auto pb-0.5 pt-0.5 [scrollbar-width:none] sm:gap-1.5 [&::-webkit-scrollbar]:hidden"
      aria-label="Разделы админки"
    >
      <Link href="/admin/posts" className={pillTabClass(postsActive)}>
        Посты
      </Link>
      <Link href="/admin/telegram" className={pillTabClass(telegramActive)}>
        Telegram
      </Link>
      <Link href="/admin/categories" className={pillTabClass(categoriesActive)}>
        Категории
      </Link>
      <Link href="/admin/settings" className={pillTabClass(settingsActive)}>
        Настройки
      </Link>
      <button
        type="button"
        className={pillTabClass(false)}
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          window.location.href = "/admin/login";
        }}
      >
        Выйти
      </button>
    </nav>
  );
}
