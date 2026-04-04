"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { pillTabClass } from "@/lib/pill-tab-styles";
import { LinkPendingBackdrop } from "@/components/ui/LinkPendingBackdrop";

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
      <Link
        href="/admin/posts"
        prefetch
        className={`relative ${pillTabClass(postsActive)}`}
      >
        Посты
        <LinkPendingBackdrop />
      </Link>
      <Link
        href="/admin/telegram"
        prefetch
        className={`relative ${pillTabClass(telegramActive)}`}
      >
        Импорт
        <LinkPendingBackdrop />
      </Link>
      <Link
        href="/admin/categories"
        prefetch
        className={`relative ${pillTabClass(categoriesActive)}`}
      >
        Категории
        <LinkPendingBackdrop />
      </Link>
      <Link
        href="/admin/settings"
        prefetch
        className={`relative ${pillTabClass(settingsActive)}`}
      >
        Настройки
        <LinkPendingBackdrop />
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
