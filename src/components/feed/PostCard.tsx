"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { PostImpression } from "./PostImpression";
import type { FeedPost } from "@/types/feed";
import { MediaGrid } from "./MediaGrid";
import { dispatchFeedRefreshReplace } from "@/lib/feed-refresh";
import { saveFeedScrollPosition } from "@/lib/feed-scroll";
import {
  MoreHorizontal,
  Share2,
  ExternalLink,
  Edit3,
  EyeOff,
  Trash2,
  X,
  ArrowLeft,
  Plus,
  Loader2,
} from "lucide-react";

export type { FeedPost };

type Props = {
  post: FeedPost;
  plausibleDomain?: string;
  yandexMetrikaId?: string;
  siteUrl: string;
  canManage?: boolean;
  /** Страница отдельного поста — без кнопки «Открыть отдельно» */
  standalone?: boolean;
};

function formatDate(iso: string | null) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function PostCard({
  post,
  plausibleDomain,
  yandexMetrikaId,
  siteUrl,
  canManage = false,
  standalone = false,
}: Props) {
  const router = useRouter();
  const postUrl = `/p/${post.slug}`;
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editBody, setEditBody] = useState(post.body);
  const [editImages, setEditImages] = useState(post.images);
  const swipeStartX = useRef<number | null>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null,
  );

  const imageList = useMemo(
    () =>
      post.images.map((im) => ({
        ...im,
        src: im.variants.w1280 ?? im.variants.w960 ?? im.variants.w640,
      })),
    [post.images],
  );
  const viewerImage = viewerIndex === null ? null : imageList[viewerIndex];

  useEffect(() => {
    setEditBody(post.body);
    setEditImages(post.images);
  }, [post]);

  useEffect(() => {
    if (viewerIndex === null) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [viewerIndex]);

  function updateMenuPosition() {
    const el = menuTriggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 8;
    setMenuPos({
      top: rect.bottom + gap,
      right: window.innerWidth - rect.right,
    });
  }

  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuPos(null);
      return;
    }
    updateMenuPosition();
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onReposition = () => updateMenuPosition();
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (menuTriggerRef.current?.contains(t)) return;
      if (menuPanelRef.current?.contains(t)) return;
      setMenuOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  function sharePost() {
    const url = `${siteUrl.replace(/\/$/, "")}${postUrl}`;
    if (navigator.share) {
      void navigator.share({ title: post.title, text: post.title, url }).catch(() => {});
    } else {
      void navigator.clipboard.writeText(url);
    }
  }

  async function setDraft() {
    setWorking(true);
    await fetch(`/api/admin/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "DRAFT" }),
    });
    setWorking(false);
    setMenuOpen(false);
    if (standalone) {
      router.push("/");
    } else {
      dispatchFeedRefreshReplace();
      router.refresh();
    }
  }

  async function deletePost() {
    if (!window.confirm("Удалить пост?")) return;
    setWorking(true);
    await fetch(`/api/admin/posts/${post.id}`, { method: "DELETE" });
    setWorking(false);
    setMenuOpen(false);
    if (standalone) {
      router.push("/");
    } else {
      dispatchFeedRefreshReplace();
      router.refresh();
    }
  }

  async function saveInline() {
    setWorking(true);
    const res = await fetch(`/api/admin/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "",
        body: editBody,
        displayMode: "GRID",
        images: editImages.map((image, index) => ({
          id: image.id,
          sortOrder: index,
          caption: image.caption,
          alt: image.alt,
        })),
      }),
    });
    setWorking(false);
    if (res.ok) {
      setEditMode(false);
      setMenuOpen(false);
      router.refresh();
    }
  }

  async function uploadInline(files: FileList | null) {
    if (!files?.length) return;
    setWorking(true);
    try {
      const added: typeof editImages = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set("postId", post.id);
        fd.set("file", file);
        const res = await fetch("/api/admin/upload", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) continue;
        const row = (await res.json()) as {
          id: string;
          sortOrder: number;
          variants: Record<string, string>;
          width?: number | null;
          height?: number | null;
        };
        added.push({
          ...row,
          width: row.width ?? null,
          height: row.height ?? null,
          caption: "",
          alt: "",
        });
      }
      if (added.length) {
        setEditImages((prev) => [...prev, ...added]);
      }
    } finally {
      setWorking(false);
    }
  }

  async function removeInlineImage(imageId: string) {
    setWorking(true);
    await fetch(`/api/admin/images/${imageId}`, { method: "DELETE" });
    setEditImages((prev) => prev.filter((image) => image.id !== imageId));
    setWorking(false);
  }

  return (
    <>
      <article className="relative scroll-mt-24 overflow-hidden rounded-[24px] border border-stone-200/80 bg-white/95 p-4 shadow-[0_8px_30px_-10px_rgba(60,44,29,0.15)] backdrop-blur-sm sm:rounded-[30px] sm:p-7">
        {plausibleDomain || yandexMetrikaId?.trim() ? (
          <PostImpression
            slug={post.slug}
            plausibleDomain={plausibleDomain}
            yandexMetrikaId={yandexMetrikaId}
          />
        ) : null}

        <header className="relative mb-4 flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[13px] font-medium text-stone-400">
              {post.publishedAt ? (
                <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
              ) : (
                <span className="text-amber-600">Черновик</span>
              )}
              {post.pinned ? (
                <span className="h-1 w-1 rounded-full bg-stone-300" />
              ) : null}
              {post.pinned ? (
                <span className="text-amber-700">Закреплено</span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {standalone ? (
              <Link
                href="/"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition active:scale-90"
              >
                <ArrowLeft size={18} />
              </Link>
            ) : null}
            <div className="relative">
              <button
                ref={menuTriggerRef}
                type="button"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition active:scale-90"
                onClick={() => setMenuOpen((value) => !value)}
              >
                <MoreHorizontal size={18} />
              </button>
              {menuOpen && menuPos
                ? createPortal(
                    <div
                      ref={menuPanelRef}
                      className="fixed z-[100] w-56 overflow-hidden rounded-2xl border border-stone-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100"
                      style={{
                        top: menuPos.top,
                        right: menuPos.right,
                      }}
                      role="menu"
                    >
                      {!standalone ? (
                        <Link
                          href={postUrl}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-stone-700 hover:bg-stone-50 active:bg-stone-100"
                          onClick={() => {
                            saveFeedScrollPosition();
                            setMenuOpen(false);
                          }}
                          role="menuitem"
                        >
                          <ExternalLink size={16} className="text-stone-400" />
                          Открыть пост
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-stone-700 hover:bg-stone-50 active:bg-stone-100"
                        role="menuitem"
                        onClick={() => {
                          sharePost();
                          setMenuOpen(false);
                        }}
                      >
                        <Share2 size={16} className="text-stone-400" />
                        Поделиться
                      </button>
                      {canManage ? (
                        <>
                          <div className="my-1.5 h-px bg-stone-100" />
                          <button
                            type="button"
                            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-stone-700 hover:bg-stone-50 active:bg-stone-100"
                            role="menuitem"
                            onClick={() => {
                              setEditMode(true);
                              setMenuOpen(false);
                            }}
                          >
                            <Edit3 size={16} className="text-stone-400" />
                            Редактировать
                          </button>
                          <button
                            type="button"
                            disabled={working}
                            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-stone-700 hover:bg-stone-50 active:bg-stone-100 disabled:opacity-50"
                            role="menuitem"
                            onClick={() => void setDraft()}
                          >
                            <EyeOff size={16} className="text-stone-400" />
                            В черновики
                          </button>
                          <button
                            type="button"
                            disabled={working}
                            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-red-600 hover:bg-red-50 active:bg-red-100 disabled:opacity-50"
                            role="menuitem"
                            onClick={() => void deletePost()}
                          >
                            <Trash2 size={16} className="text-red-400" />
                            Удалить
                          </button>
                        </>
                      ) : null}
                    </div>,
                    document.body,
                  )
                : null}
            </div>
          </div>
        </header>

        {post.body ? (
          <div className="mb-5 whitespace-pre-wrap text-[15px] leading-relaxed text-stone-800 sm:text-[16px] sm:leading-8">
            {post.body}
          </div>
        ) : null}

        {!standalone && post.images.length > 0 ? (
          <MediaGrid
            images={imageList.map((image) => ({
              id: image.id,
              src: image.src,
              alt: image.alt || post.title,
            }))}
            onImageClick={(index) => setViewerIndex(index)}
          />
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {post.images.map((im, i) => (
              <button
                key={im.id}
                type="button"
                className="block w-full overflow-hidden rounded-2xl text-left transition active:scale-[0.98]"
                onClick={() => setViewerIndex(i)}
              >
                <ResponsiveImage
                  variants={im.variants}
                  alt={im.alt || post.title}
                  caption={im.caption}
                  priority={i === 0}
                  className="rounded-2xl sm:rounded-[22px]"
                />
              </button>
            ))}
          </div>
        )}

        {canManage && editMode ? (
          <div className="mt-5 space-y-4 rounded-2xl border border-stone-200 bg-stone-50/80 p-4 sm:rounded-[24px]">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-stone-900 uppercase tracking-tight">
                Редактирование
              </h3>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full text-stone-400 hover:bg-stone-200 active:scale-90"
                onClick={() => setEditMode(false)}
              >
                <X size={18} />
              </button>
            </div>
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="min-h-[140px] w-full resize-none rounded-xl border border-stone-200 bg-white px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400"
              placeholder="Текст поста"
            />
            
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={working}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.multiple = true;
                  input.accept = 'image/*';
                  input.onchange = (e) => {
                    const files = (e.target as HTMLInputElement).files;
                    void uploadInline(files);
                  };
                  input.click();
                }}
                className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition active:scale-95 disabled:opacity-50"
              >
                {working ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Добавить фото
              </button>
            </div>

            {editImages.length ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {editImages.map((image) => {
                  const src =
                    image.variants.w640 ??
                    image.variants.w960 ??
                    image.variants.w1280;
                  return (
                    <div
                      key={image.id}
                      className="group relative aspect-square overflow-hidden rounded-xl border border-stone-200 bg-white"
                    >
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={src}
                          alt={image.alt || post.title}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                      <button
                        type="button"
                        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-red-600 shadow-sm transition active:scale-90"
                        onClick={() => void removeInlineImage(image.id)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                disabled={working}
                className="flex-1 rounded-full bg-stone-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition active:scale-95 disabled:opacity-50"
                onClick={() => void saveInline()}
              >
                {working ? "..." : "Сохранить"}
              </button>
              <button
                type="button"
                className="flex-1 rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition active:scale-95"
                onClick={() => setEditMode(false)}
              >
                Отмена
              </button>
            </div>
          </div>
        ) : null}
      </article>

      {viewerImage?.src ? (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center overscroll-none bg-black/95 p-4 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setViewerIndex(null)}
          role="presentation"
        >
          <div
            className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 border-b border-white/15 bg-black/75 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="flex items-center gap-2 rounded-full px-3 py-2.5 text-[15px] font-semibold text-white transition active:bg-white/15"
              onClick={() => setViewerIndex(null)}
            >
              <X size={20} strokeWidth={2.25} aria-hidden />
              Закрыть
            </button>
            {imageList.length > 1 ? (
              <span className="shrink-0 text-sm tabular-nums text-white/65">
                {viewerIndex !== null ? viewerIndex + 1 : 1} / {imageList.length}
              </span>
            ) : null}
          </div>

          <div
            className="relative flex h-full w-full max-h-[85dvh] touch-pan-y items-center justify-center pt-14"
            onClick={(event) => event.stopPropagation()}
            onTouchStart={(e) => {
              swipeStartX.current = e.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(e) => {
              if (
                imageList.length < 2 ||
                swipeStartX.current == null ||
                viewerIndex === null
              ) {
                swipeStartX.current = null;
                return;
              }
              const x = e.changedTouches[0]?.clientX;
              if (x == null) {
                swipeStartX.current = null;
                return;
              }
              const dx = x - swipeStartX.current;
              swipeStartX.current = null;
              if (dx > 56) {
                setViewerIndex((cur) =>
                  cur === null
                    ? 0
                    : (cur - 1 + imageList.length) % imageList.length,
                );
              } else if (dx < -56) {
                setViewerIndex((cur) =>
                  cur === null ? 0 : (cur + 1) % imageList.length,
                );
              }
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={viewerImage.src}
              alt={viewerImage.alt || post.title}
              className="max-h-full max-w-full select-none rounded-lg object-contain shadow-2xl"
              draggable={false}
            />
          </div>

          {viewerImage.caption ? (
            <div className="pointer-events-none absolute bottom-safe-offset-8 left-4 right-4 mx-auto max-w-2xl">
              <p className="rounded-2xl bg-black/40 p-4 text-center text-[15px] leading-relaxed text-white/90 backdrop-blur-md">
                {viewerImage.caption}
              </p>
            </div>
          ) : null}

          {imageList.length > 1 ? (
            <div
              className="absolute bottom-4 z-10 flex items-center justify-center gap-2"
              onClick={(e) => e.stopPropagation()}
            >
              {imageList.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Фото ${i + 1} из ${imageList.length}`}
                  aria-current={i === viewerIndex ? "true" : undefined}
                  className="flex h-10 min-w-10 items-center justify-center p-2"
                  onClick={() => setViewerIndex(i)}
                >
                  <span
                    className={`block h-1.5 rounded-full transition-all duration-300 ${
                      i === viewerIndex ? "w-4 bg-white" : "w-1.5 bg-white/30"
                    }`}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
