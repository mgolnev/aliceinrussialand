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
import { ImageLightbox } from "./ImageLightbox";
import { FeedComposerPanel } from "@/components/feed/FeedComposerPanel";
import { dispatchFeedRefreshMerge, dispatchFeedRefreshReplace } from "@/lib/feed-refresh";
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
  const [editMessage, setEditMessage] = useState<string | null>(null);
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

  function cancelEdit() {
    setEditMode(false);
    setEditMessage(null);
    setEditBody(post.body);
    setEditImages(post.images);
  }

  async function saveEdit(status: "DRAFT" | "PUBLISHED") {
    setWorking(true);
    setEditMessage(null);
    const payload: Record<string, unknown> = {
      title: "",
      body: editBody,
      displayMode: "GRID",
      status,
    };
    if (editImages.length > 0) {
      payload.images = editImages.map((image, index) => ({
        id: image.id,
        sortOrder: index,
        caption: image.caption,
        alt: image.alt,
      }));
    }
    const res = await fetch(`/api/admin/posts/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    setWorking(false);
    if (res.ok) {
      setEditMode(false);
      setMenuOpen(false);
      setEditMessage(null);
      dispatchFeedRefreshMerge();
      router.refresh();
    } else {
      setEditMessage(data?.error ?? "Не удалось сохранить");
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

  const feedMediaGrid = !standalone && post.images.length > 0;
  const articlePad =
    canManage && editMode
      ? "p-0"
      : feedMediaGrid
        ? "px-3 sm:px-5 pt-3 pb-0 sm:pt-4"
        : "px-3 sm:px-5 py-3 sm:py-5";

  return (
    <>
      <article
        className={`relative min-w-0 scroll-mt-24 overflow-hidden rounded-[24px] border border-stone-200/80 bg-white/95 shadow-[0_8px_30px_-10px_rgba(60,44,29,0.15)] backdrop-blur-sm sm:rounded-[30px] ${articlePad}`}
      >
        {plausibleDomain || yandexMetrikaId?.trim() ? (
          <PostImpression
            slug={post.slug}
            plausibleDomain={plausibleDomain}
            yandexMetrikaId={yandexMetrikaId}
          />
        ) : null}

        <header
          className={`relative flex items-start justify-between gap-3 ${
            canManage && editMode
              ? "border-b border-stone-100 px-3 pb-2.5 pt-3 sm:px-5 sm:pb-3 sm:pt-4"
              : feedMediaGrid
                ? "mb-2 sm:mb-3"
                : "mb-4"
          }`}
        >
          <div className="min-w-0 flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-stone-400">
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
            {canManage && editMode ? (
              <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                Редактирование
              </span>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {standalone ? (
              <Link
                href="/"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition active:scale-90"
              >
                <ArrowLeft size={18} />
              </Link>
            ) : null}
            {canManage && editMode ? (
              <button
                type="button"
                aria-label="Закрыть редактирование"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition active:scale-90"
                onClick={() => cancelEdit()}
              >
                <X size={18} />
              </button>
            ) : (
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
                              setEditMessage(null);
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
            )}
          </div>
        </header>

        {canManage && editMode ? (
          <div className="px-3 pb-2 pt-2 sm:px-5 sm:pb-2 sm:pt-3">
          <FeedComposerPanel
            variant="embedded"
            headerLeft=""
            body={editBody}
            onBodyChange={setEditBody}
            images={editImages}
            onImagesChange={(next) =>
              setEditImages(
                next.map((im) => ({
                  id: im.id,
                  variants: im.variants,
                  width: im.width ?? null,
                  height: im.height ?? null,
                  caption: im.caption ?? "",
                  alt: im.alt ?? "",
                })),
              )
            }
            onRemoveImage={(id) => void removeInlineImage(id)}
            uploadFiles={(files) => void uploadInline(files)}
            working={working}
            message={editMessage}
            onSubmitDraft={() => void saveEdit("DRAFT")}
            onSubmitPublish={() => void saveEdit("PUBLISHED")}
            canSubmit={
              editBody.trim().length > 0 || editImages.length > 0
            }
            publishLabel={post.publishedAt ? "Сохранить" : "Опубликовать"}
          />
          </div>
        ) : (
          <>
            {post.body ? (
              <div
                className={`min-w-0 whitespace-pre-wrap text-[15px] leading-relaxed text-stone-800 sm:text-[16px] sm:leading-8 ${
                  feedMediaGrid ? "mb-2 sm:mb-2.5" : "mb-3 sm:mb-5"
                }`}
              >
                {post.body}
              </div>
            ) : null}

            {!standalone && post.images.length > 0 ? (
              <div className="min-w-0">
                <MediaGrid
                  fullBleed
                  flushCardBottom
                  layoutSeed={post.id}
                  images={imageList.map((image) => ({
                    id: image.id,
                    src: image.src,
                    alt: image.alt || post.title,
                    width: image.width,
                    height: image.height,
                  }))}
                  onImageClick={(index) => setViewerIndex(index)}
                />
              </div>
            ) : (
              <div className="min-w-0 space-y-3 sm:space-y-4">
                {post.images.map((im, i) => (
                  <button
                    key={im.id}
                    type="button"
                    className="block w-full min-w-0 overflow-hidden rounded-2xl text-left transition active:scale-[0.98]"
                    onClick={() => setViewerIndex(i)}
                  >
                    <ResponsiveImage
                      variants={im.variants}
                      alt={im.alt || post.title}
                      caption={im.caption}
                      priority={i === 0}
                      className="rounded-xl sm:rounded-[14px]"
                    />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </article>

      {viewerIndex !== null && viewerImage?.src ? (
        <ImageLightbox
          slides={imageList.map((im) => ({
            src: im.src ?? "",
            alt: im.alt || post.title,
            caption: im.caption || undefined,
          }))}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onIndexChange={setViewerIndex}
        />
      ) : null}
    </>
  );
}
