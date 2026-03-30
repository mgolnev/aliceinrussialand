"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ImageIcon, MoreHorizontal } from "lucide-react";
import { POST_STATUS } from "@/lib/constants";
import {
  dispatchFeedRefreshMerge,
  dispatchFeedRefreshReplace,
} from "@/lib/feed-refresh";
import { LinkPendingBackdrop } from "@/components/ui/LinkPendingBackdrop";

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
  const boxClass =
    "relative h-full w-full min-h-0 min-w-0 overflow-hidden rounded-[10px]";

  if (imageCount === 0) {
    return (
      <div
        className={`${boxClass} flex shrink-0 items-center justify-center bg-stone-100 ring-1 ring-stone-200/70`}
        aria-hidden
      >
        <ImageIcon className="h-[22%] min-h-4 w-[22%] min-w-4 text-stone-300" strokeWidth={1.5} />
      </div>
    );
  }

  if (!thumbUrl) {
    return (
      <div
        className={`${boxClass} flex shrink-0 items-center justify-center bg-stone-100 ring-1 ring-stone-200/70`}
        aria-label={`${imageCount} фото`}
      >
        <ImageIcon className="h-[22%] min-h-4 w-[22%] min-w-4 text-stone-400" strokeWidth={1.5} />
        {extra > 0 ? (
          <span className="absolute bottom-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded bg-stone-900/88 px-0.5 text-[9px] font-bold leading-none text-white shadow-sm">
            +{extra}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`${boxClass} shrink-0 ring-1 ring-stone-200/80`}
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
        className="h-full w-full object-cover"
        loading="lazy"
      />
      {extra > 0 ? (
        <span className="absolute bottom-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded bg-stone-900/88 px-0.5 text-[9px] font-bold leading-none text-white shadow-sm">
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
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null,
  );

  const updateMenuPosition = useCallback(() => {
    const el = menuTriggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 6;
    setMenuPos({
      top: rect.bottom + gap,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, []);

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuPos(null);
      return;
    }
    updateMenuPosition();
  }, [menuOpen, updateMenuPosition]);

  useEffect(() => {
    if (!menuOpen) return;
    const onScrollOrResize = () => updateMenuPosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [menuOpen, updateMenuPosition]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (menuTriggerRef.current?.contains(t)) return;
      if (menuPanelRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
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
      <div className="group flex min-h-[5rem] items-stretch overflow-visible sm:min-h-[5.25rem]">
        <Link
          href={href}
          className="relative flex min-h-0 min-w-0 flex-1 items-stretch gap-3 py-2 pl-3 pr-1 transition-[colors,transform] motion-safe:active:scale-[0.995] motion-safe:active:bg-stone-100/80 sm:gap-4 sm:py-2.5 sm:pl-4 sm:pr-2 group-hover:bg-stone-50/95"
        >
          <LinkPendingBackdrop />
          <div className="relative z-[1] box-border flex h-full min-h-0 shrink-0 items-center self-stretch py-1 pl-0 pr-0 sm:py-1.5">
            <div className="relative aspect-square h-[88%] max-h-[7rem] min-h-[4rem] w-auto min-w-[4rem] max-w-[7rem] sm:h-[90%] sm:min-h-[4.25rem] sm:max-h-[7.25rem] sm:min-w-[4.25rem] sm:max-w-[7.25rem]">
              <PostThumb thumbUrl={p.thumbUrl} imageCount={p.imageCount} />
            </div>
          </div>
          <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col justify-start pr-2 pt-1 pb-1">
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

        <div className="relative z-10 flex w-11 shrink-0 flex-col items-stretch self-stretch overflow-visible border-l border-stone-200/40 bg-white/80 group-hover:bg-stone-50/90 sm:w-12">
          <div className="flex shrink-0 justify-center pt-2 sm:pt-2.5">
            <button
              ref={menuTriggerRef}
              type="button"
              className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-stone-300 transition-colors hover:bg-stone-100/80 hover:text-stone-600 active:bg-stone-200/40"
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
          </div>
          {menuOpen && menuPos
            ? createPortal(
                <div
                  ref={menuPanelRef}
                  className="fixed z-[200] min-w-[200px] rounded-xl border border-stone-200/90 bg-white py-1 shadow-lg"
                  style={{ top: menuPos.top, right: menuPos.right }}
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
                      setMenuOpen(false);
                      void navigator.clipboard
                        .writeText(`${base}/p/${p.slug}`)
                        .catch(() => {});
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
                </div>,
                document.body,
              )
            : null}
        </div>
      </div>
    </li>
  );
}
