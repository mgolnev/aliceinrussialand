import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { POST_STATUS } from "@/lib/constants";

export default async function AdminPostsPage() {
  const posts = await prisma.post.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    include: { _count: { select: { images: true } } },
  });

  return (
    <ul className="space-y-3">
      {posts.length === 0 ? (
        <li className="rounded-[24px] border border-dashed border-stone-300 bg-white/75 px-4 py-10 text-center text-sm leading-relaxed text-stone-500">
          Пока нет постов. Новую запись можно начать в ленте на главной.
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
  );
}
