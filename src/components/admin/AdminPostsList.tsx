"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImageIcon, MoreHorizontal } from "lucide-react";
import { POST_STATUS } from "@/lib/constants";
import {
  dispatchFeedRefreshMerge,
  dispatchFeedRefreshReplace,
} from "@/lib/feed-refresh";

export type AdminPostListRow = {
  id: string;
  slug: string;
  preview: string;
  status: string;
  publishedAt: string | null;
  updatedAt: string;
  imageCount: number;
  thumbUrl: string | null;
  categoryName: string | null;
};

const MONTHS_SHORT = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
] as const;

/** Для строки мета: «25 мар» */
function formatMetaDate(publishedAt: string | null, updatedAt: string) {
  const d = publishedAt ? new Date(publishedAt) : new Date(updatedAt);
  const day = d.getDate();
  const mo = MONTHS_SHORT[d.getMonth()] ?? "";
  return `${day} ${mo}`;
}

function PostThumb({
  thumbUrl,
  imageCount,
}: {
  thumbUrl: string | null;
  imageCount: number;
}) {
  const extra = imageCount > 1 ? imageCount - 1 : 0;

  if (imageCount === 0) {
    return (
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-stone-100 ring-1 ring-stone-200/70"
        aria-hidden
      >
        <ImageIcon className="h-4 w-4 text-stone-300" strokeWidth={1.5} />
      </div>
    );
  }

  if (!thumbUrl) {
    return (
      <div
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-stone-100 ring-1 ring-stone-200/70"
        aria-label={`${imageCount} фото`}
      >
        <ImageIcon className="h-4 w-4 text-stone-400" strokeWidth={1.5} />
        {extra > 0 ? (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded bg-stone-900/88 px-0.5 text-[9px] font-bold leading-none text-white shadow-sm">
            +{extra}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="relative h-11 w-11 shrink-0"
      aria-label={
        imageCount === 1
          ? "1 фото"
          : `1 фото из ${imageCount}, ещё ${extra}`
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbUrl}
        alt=""
        className="h-full w-full rounded-[10px] object-cover ring-1 ring-stone-200/80"
        loading="lazy"
      />
      {extra > 0 ? (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded bg-stone-900/88 px-0.5 text-[9px] font-bold leading-none text-white shadow-sm">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

export function AdminPostsList({
  posts,
  siteUrl,
}: {
  posts: AdminPostListRow[];
  siteUrl: string;
}) {
  return (
    <ul className="rounded-2xl border border-stone-200/60 bg-white shadow-sm ring-1 ring-stone-100/80">
      {posts.map((p) => (
        <AdminPostRow key={p.id} post={p} siteUrl={siteUrl} />
      ))}
    </ul>
  );
}

function AdminPostRow({
  post: p,
  siteUrl,
}: {
  post: AdminPostListRow;
  siteUrl: string;
}) {
  const router = useRouter();
  const base = siteUrl.replace(/\/$/, "");
  const published = p.status === POST_STATUS.PUBLISHED;
  const href = published ? `/p/${p.slug}` : `/admin/posts/${p.id}/edit`;
  const metaDate = formatMetaDate(p.publishedAt, p.updatedAt);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const root = menuWrapRef.current;
      if (root && !root.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen]);

  const patchStatus = useCallback(
    async (status: string) => {
      setBusy(true);
      try {
        const res = await fetch(`/api/admin/posts/${p.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!res.ok) return;
        setMenuOpen(false);
        if (status === POST_STATUS.PUBLISHED) {
          dispatchFeedRefreshMerge();
        } else {
          dispatchFeedRefreshReplace();
        }
        router.refresh();
      } finally {
        setBusy(false);
      }
    },
    [p.id, router],
  );

  const deletePost = useCallback(async () => {
    if (!window.confirm("Удалить пост и все фото? Это необратимо.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/posts/${p.id}`, { method: "DELETE" });
      if (!res.ok) return;
      setMenuOpen(false);
      dispatchFeedRefreshReplace();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }, [p.id, router]);

  const statusLabel = published ? "Опубликовано" : "Черновик";

  return (
    <li className="touch-manipulation overflow-visible border-b border-stone-200/50 last:border-b-0">
      <div className="group flex items-start overflow-visible">
        <Link
          href={href}
          className="flex min-w-0 flex-1 items-start gap-3 py-3 pl-3 pr-1 transition-colors active:bg-stone-100/80 sm:gap-4 sm:py-3.5 sm:pl-4 sm:pr-2 group-hover:bg-stone-50/95"
        >
          <div className="mt-1 shrink-0">
            <PostThumb thumbUrl={p.thumbUrl} imageCount={p.imageCount} />
          </div>
          <div className="min-w-0 flex-1 pr-2">
            <p className="line-clamp-2 text-[13px] font-normal leading-[1.35] text-stone-800">
              {p.preview}
            </p>
            {p.categoryName ? (
              <p className="mt-2 text-[11px] font-normal leading-none tracking-wide text-stone-400">
                {p.categoryName.toLocaleLowerCase("ru-RU")}
              </p>
            ) : null}
            <p
              className={`flex min-w-0 flex-wrap items-center gap-x-1 text-[11px] font-normal leading-none text-stone-400 ${p.categoryName ? "mt-2" : "mt-2.5"}`}
            >
              <span
                className={`inline-flex shrink-0 items-center gap-1 ${
                  published ? "text-stone-500" : "text-stone-400"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    published
                      ? "bg-emerald-500/45"
                      : "bg-stone-400/45"
                  }`}
                  aria-hidden
                />
                <span>{statusLabel}</span>
              </span>
              <span className="text-stone-300" aria-hidden>
                ·
              </span>
              <time
                className="tabular-nums text-stone-400"
                dateTime={p.publishedAt ?? p.updatedAt}
              >
                {metaDate}
              </time>
            </p>
            <p
              className="mt-2 max-w-full truncate font-mono text-[10px] leading-tight text-stone-400/35"
              title={`/p/${p.slug}`}
            >
              /p/{p.slug}
            </p>
          </div>
        </Link>

        <div
          ref={menuWrapRef}
          className="relative z-10 flex shrink-0 self-stretch overflow-visible border-l border-stone-200/40 bg-white/80 group-hover:bg-stone-50/90"
        >
          <button
            type="button"
            className="flex min-h-[4.25rem] w-11 items-start justify-center px-1 pt-3.5 text-stone-300 transition-colors hover:bg-stone-100/80 hover:text-stone-600 active:bg-stone-200/40 sm:min-h-[4.5rem] sm:w-12 sm:pt-4"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-label="Действия"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
          >
            <MoreHorizontal className="h-5 w-5" strokeWidth={1.5} />
          </button>
          {menuOpen ? (
            <div
              className="absolute right-0 top-full z-[100] min-w-[200px] rounded-xl border border-stone-200/90 bg-white py-1 shadow-lg"
              role="menu"
            >
              <Link
                href={`/admin/posts/${p.id}/edit`}
                role="menuitem"
                className="block px-3 py-2 text-[14px] text-stone-800 hover:bg-stone-50"
                onClick={() => setMenuOpen(false)}
              >
                Slug и SEO
              </Link>
              {published ? (
                <Link
                  href={`/p/${p.slug}`}
                  role="menuitem"
                  className="block px-3 py-2 text-[14px] text-stone-800 hover:bg-stone-50"
                  onClick={() => setMenuOpen(false)}
                >
                  Открыть на сайте
                </Link>
              ) : null}
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                className="block w-full px-3 py-2 text-left text-[14px] text-stone-800 hover:bg-stone-50 disabled:opacity-50"
                onClick={() => {
                  void navigator.clipboard.writeText(`${base}/p/${p.slug}`);
                  setMenuOpen(false);
                }}
              >
                Копировать URL
              </button>
              <div className="my-1 border-t border-stone-100" />
              {published ? (
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  className="block w-full px-3 py-2 text-left text-[14px] text-stone-800 hover:bg-stone-50 disabled:opacity-50"
                  onClick={() => void patchStatus(POST_STATUS.DRAFT)}
                >
                  В черновик
                </button>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  disabled={busy}
                  className="block w-full px-3 py-2 text-left text-[14px] text-emerald-800 hover:bg-emerald-50/80 disabled:opacity-50"
                  onClick={() => void patchStatus(POST_STATUS.PUBLISHED)}
                >
                  Опубликовать
                </button>
              )}
              <div className="my-1 border-t border-stone-100" />
              <button
                type="button"
                role="menuitem"
                disabled={busy}
                className="block w-full px-3 py-2 text-left text-[14px] text-red-600 hover:bg-red-50 disabled:opacity-50"
                onClick={() => void deletePost()}
              >
                Удалить
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
