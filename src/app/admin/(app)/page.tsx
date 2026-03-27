import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { POST_STATUS } from "@/lib/constants";

export default async function AdminHomePage() {
  const posts = await prisma.post.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { _count: { select: { images: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-[28px] border border-stone-200/80 bg-white/90 p-6 shadow-[0_20px_50px_-40px_rgba(60,44,29,0.35)]">
        <div className="space-y-2">
          <p className="text-sm font-medium text-stone-500">Публикации</p>
          <h1 className="text-3xl font-semibold tracking-tight">Лента постов</h1>
          <p className="max-w-xl text-sm leading-6 text-stone-600">
            Быстрый сценарий как в канале: создали пост, добавили фото,
            опубликовали. Черновики и уже выпущенные посты находятся в одном
            месте.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/telegram"
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 shadow-sm hover:border-stone-400"
          >
            Импорт из Telegram
          </Link>
          <Link
            href="/admin/posts/new"
            className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-stone-800"
          >
            + Новый пост
          </Link>
        </div>
      </div>

      <ul className="space-y-3">
        {posts.length === 0 ? (
          <li className="rounded-[24px] border border-dashed border-stone-300 bg-white/75 px-4 py-10 text-center text-stone-500">
            Пока нет постов — создайте первый.
          </li>
        ) : (
          posts.map((p) => (
            <li
              key={p.id}
              className="rounded-[24px] border border-stone-200/80 bg-white/90 p-4 shadow-[0_18px_40px_-40px_rgba(60,44,29,0.4)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        p.status === POST_STATUS.PUBLISHED
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {p.status === POST_STATUS.PUBLISHED
                        ? "Опубликовано"
                        : "Черновик"}
                    </span>
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600">
                      {p._count.images} фото
                    </span>
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600">
                      {p.displayMode === "STACK" ? "Последовательно" : "Плитка"}
                    </span>
                  </div>
                  <Link
                    href={`/admin/posts/${p.id}/edit`}
                    className="block text-lg font-semibold text-stone-900 hover:underline"
                  >
                    {p.title || "Без названия"}
                  </Link>
                  <p className="truncate text-sm text-stone-500">/p/{p.slug}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600">
                    {new Intl.DateTimeFormat("ru-RU", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(p.updatedAt)}
                  </span>
                  <Link
                    href={`/admin/posts/${p.id}/edit`}
                    className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 shadow-sm hover:border-stone-300"
                  >
                    Открыть редактор
                  </Link>
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
