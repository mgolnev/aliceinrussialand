"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { ShareForwardIcon } from "@/components/ui/ShareForwardIcon";
import { PostImpression } from "./PostImpression";
import { PostOpenLinkOverlay } from "./PostOpenLinkOverlay";
import type { FeedCategory, FeedPost } from "@/types/feed";
import { MediaGrid } from "./MediaGrid";
import { ImageLightbox } from "./ImageLightbox";
import {
  dispatchFeedPostUpdate,
  dispatchFeedRefreshMerge,
  dispatchFeedRefreshReplace,
} from "@/lib/feed-refresh";
import { feedPostFromAdminPatchJson } from "@/lib/feed-post-from-admin-patch";
import {
  adminCredentials,
  readAdminResponseJson,
} from "@/lib/admin-fetch";
import { useFeedImageUploadQueue } from "@/hooks/use-feed-image-upload-queue";
import type { FeedComposerImage } from "@/components/feed/FeedComposerPanel";
import {
  firstSentence,
  stripLeadingTitleFromBody,
} from "@/lib/post-title-body-split";
import {
  MoreHorizontal,
  ExternalLink,
  Edit3,
  EyeOff,
  Trash2,
  X,
  Pin,
  PinOff,
} from "lucide-react";

const FeedComposerPanelLazy = dynamic(
  () =>
    import("./FeedComposerPanel").then((m) => ({
      default: m.FeedComposerPanel,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="mx-3 mb-3 h-40 animate-pulse rounded-2xl bg-stone-100 sm:mx-5"
        aria-hidden
      />
    ),
  },
);

export type { FeedPost };

type Props = {
  post: FeedPost;
  categories?: FeedCategory[];
  plausibleDomain?: string;
  yandexMetrikaId?: string;
  siteUrl: string;
  canManage?: boolean;
  prioritizeMedia?: boolean;
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

function buildFeedGridSources(variants: Record<string, string>) {
  const entries: Array<{ width: number; url: string }> = [640, 960, 1280]
    .map((width) => ({ width, url: variants[`w${width}`] }))
    .filter((item): item is { width: number; url: string } => Boolean(item.url));
  if (!entries.length) {
    return { src: undefined as string | undefined, srcSet: undefined as string | undefined };
  }
  const src =
    variants.w960 ??
    variants.w640 ??
    variants.w1280 ??
    entries[entries.length - 1]?.url;
  const srcSet = entries.map((item) => `${item.url} ${item.width}w`).join(", ");
  return { src, srcSet };
}

function pickLightboxSlideSrc(variants: Record<string, string>): string {
  return (
    variants.w1280 ??
    variants.w960 ??
    variants.w640 ??
    variants.w512 ??
    ""
  );
}

export function PostCard({
  post,
  categories = [],
  plausibleDomain,
  yandexMetrikaId,
  siteUrl,
  canManage = false,
  prioritizeMedia = false,
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
  const [editCategoryId, setEditCategoryId] = useState<string | null>(
    post.categoryId,
  );
  const [pinnedUi, setPinnedUi] = useState(post.pinned);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null,
  );

  const [lightboxMediaById, setLightboxMediaById] = useState<
    Record<string, Record<string, string>>
  >({});
  const lightboxMediaReadySlugRef = useRef<string | null>(null);

  const lightboxNeedsFullVariants = useMemo(
    () => post.images.some((im) => !im.variants.w1280),
    [post.images],
  );

  const lightboxSlides = useMemo(
    () =>
      post.images.map((im) => {
        const variants = {
          ...im.variants,
          ...(lightboxMediaById[im.id] ?? {}),
        };
        return {
          src: pickLightboxSlideSrc(variants),
          alt: im.alt || post.title,
          caption: im.caption || undefined,
        };
      }),
    [post.images, post.title, lightboxMediaById],
  );

  useEffect(() => {
    lightboxMediaReadySlugRef.current = null;
    setLightboxMediaById({});
  }, [post.id]);

  useEffect(() => {
    if (viewerIndex === null) return;
    if (!lightboxNeedsFullVariants) return;
    if (lightboxMediaReadySlugRef.current === post.slug) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/posts/${encodeURIComponent(post.slug)}/media`,
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          images: Array<{ id: string; variants: Record<string, string> }>;
        };
        if (cancelled) return;
        lightboxMediaReadySlugRef.current = post.slug;
        setLightboxMediaById((prev) => {
          const next = { ...prev };
          for (const row of data.images) {
            next[row.id] = row.variants;
          }
          return next;
        });
      } catch {
        /* сеть / JSON */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [viewerIndex, post.slug, lightboxNeedsFullVariants]);

  useEffect(() => {
    setEditBody(post.body);
    setEditImages(post.images);
    setEditCategoryId(post.categoryId);
    setPinnedUi(post.pinned);
  }, [post]);

  const onComposerImageUploaded = useCallback((image: FeedComposerImage) => {
    setEditImages((prev) => [
      ...prev,
      {
        id: image.id,
        variants: image.variants,
        width: image.width ?? null,
        height: image.height ?? null,
        caption: image.caption ?? "",
        alt: image.alt ?? "",
      },
    ]);
  }, []);

  const resolveComposerPostId = useCallback(async () => post.id, [post.id]);

  const {
    uploadRows,
    uploadDoneCount,
    uploadTotalPlanned,
    uploadIsProcessing,
    addUploadFiles,
    stopUpload,
    retryUpload,
    dismissCancelledUploads,
    resetUploadProgressIfIdle,
    clearUploadSession,
  } = useFeedImageUploadQueue({
    onImageUploaded: onComposerImageUploaded,
    resolvePostId: resolveComposerPostId,
    fetchInit: adminCredentials,
    onQueueError: (msg) => setEditMessage(msg),
  });

  useEffect(() => {
    if (
      editMode &&
      uploadRows.length === 0 &&
      !uploadIsProcessing &&
      uploadDoneCount > 0
    ) {
      const t = window.setTimeout(() => resetUploadProgressIfIdle(), 1800);
      return () => window.clearTimeout(t);
    }
  }, [
    editMode,
    uploadRows.length,
    uploadIsProcessing,
    uploadDoneCount,
    resetUploadProgressIfIdle,
  ]);

  useEffect(() => {
    if (!editMode) {
      stopUpload();
      clearUploadSession();
    }
  }, [editMode, stopUpload, clearUploadSession]);

  const uploadBlocksSubmit =
    uploadIsProcessing ||
    uploadRows.some(
      (r) => r.status === "pending" || r.status === "uploading",
    );

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
      void navigator
        .share({ title: post.title, text: post.title, url })
        .catch(() => {});
    } else {
      void navigator.clipboard.writeText(url).catch(() => {});
    }
  }

  async function setDraft() {
    setWorking(true);
    try {
      const res = await fetch(`/api/admin/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DRAFT" }),
        ...adminCredentials,
      });
      const data = await readAdminResponseJson(res);
      if (!res.ok) {
        const msg =
          data &&
          typeof data === "object" &&
          typeof (data as { error?: string }).error === "string"
            ? (data as { error: string }).error
            : `Ошибка ${res.status}`;
        window.alert(msg);
        return;
      }
      setMenuOpen(false);
      if (standalone) {
        router.push("/");
      } else {
        dispatchFeedRefreshReplace();
        router.refresh();
      }
    } catch {
      window.alert("Нет сети или сервер не ответил. Попробуйте снова.");
    } finally {
      setWorking(false);
    }
  }

  async function deletePost() {
    if (!window.confirm("Удалить пост?")) return;
    setWorking(true);
    try {
      const res = await fetch(`/api/admin/posts/${post.id}`, {
        method: "DELETE",
        ...adminCredentials,
      });
      if (!res.ok) {
        const data = await readAdminResponseJson(res);
        const msg =
          data &&
          typeof data === "object" &&
          typeof (data as { error?: string }).error === "string"
            ? (data as { error: string }).error
            : `Ошибка ${res.status}`;
        window.alert(msg);
        return;
      }
      setMenuOpen(false);
      if (standalone) {
        router.push("/");
      } else {
        dispatchFeedRefreshReplace();
        router.refresh();
      }
    } catch {
      window.alert("Нет сети или сервер не ответил.");
    } finally {
      setWorking(false);
    }
  }

  async function togglePin() {
    const next = !pinnedUi;
    setWorking(true);
    try {
      const res = await fetch(`/api/admin/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: next }),
        ...adminCredentials,
      });
      const data = await readAdminResponseJson(res);
      if (!res.ok) return;
      setPinnedUi(next);
      setMenuOpen(false);
      const updated = feedPostFromAdminPatchJson(data);
      if (updated) dispatchFeedPostUpdate(updated);
      dispatchFeedRefreshMerge();
      router.refresh();
    } catch {
      /* тихо: пин не критичен */
    } finally {
      setWorking(false);
    }
  }

  function cancelEdit() {
    setEditMode(false);
    setEditMessage(null);
    setEditBody(post.body);
    setEditImages(post.images);
    setEditCategoryId(post.categoryId);
  }

  async function saveEdit(status: "DRAFT" | "PUBLISHED") {
    setWorking(true);
    setEditMessage(null);
    const controller = new AbortController();
    const killSlow = window.setTimeout(() => controller.abort(), 90_000);
    const payload: Record<string, unknown> = {
      title: "",
      body: editBody,
      displayMode: post.displayMode,
      status,
      categoryId: editCategoryId,
    };
    if (editImages.length > 0) {
      payload.images = editImages.map((image, index) => ({
        id: image.id,
        sortOrder: index,
        caption: image.caption,
        alt: image.alt,
      }));
    }
    try {
      const res = await fetch(`/api/admin/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        ...adminCredentials,
        signal: controller.signal,
      });
      const data = await readAdminResponseJson(res);
      if (res.ok) {
        if (data) {
          const updated = feedPostFromAdminPatchJson(data);
          if (updated) dispatchFeedPostUpdate(updated);
        }
        setEditMode(false);
        setMenuOpen(false);
        setEditMessage(null);
        dispatchFeedRefreshMerge();
        router.refresh();
        return;
      }
      const apiErr =
        data &&
        typeof data === "object" &&
        typeof (data as { error?: string }).error === "string"
          ? (data as { error: string }).error
          : null;
      setEditMessage(
        apiErr ??
          (res.status === 401
            ? "Сессия истекла. Обновите страницу и войдите снова."
            : `Не удалось сохранить (HTTP ${res.status})`),
      );
    } catch (e) {
      const aborted = e instanceof Error && e.name === "AbortError";
      setEditMessage(
        aborted
          ? "Сервер долго не отвечает — попробуйте сохранить снова или обновите страницу."
          : "Нет сети или запрос сброшен. Проверьте подключение.",
      );
    } finally {
      window.clearTimeout(killSlow);
      setWorking(false);
    }
  }

  async function removeInlineImage(imageId: string) {
    setWorking(true);
    await fetch(`/api/admin/images/${imageId}`, {
      method: "DELETE",
      ...adminCredentials,
    });
    setEditImages((prev) => prev.filter((image) => image.id !== imageId));
    setWorking(false);
  }

  const feedMediaGrid = !standalone && post.images.length > 0;
  const postTitle = post.title?.trim() || "";
  const standaloneTitle = standalone ? firstSentence(postTitle) : postTitle;
  const postBodyForRender =
    standalone && standaloneTitle
      ? stripLeadingTitleFromBody(post.body, standaloneTitle)
      : post.body;
  const openPostAria =
    standaloneTitle ||
    post.body.trim().slice(0, 80) ||
    "Открыть пост";
  const articlePad =
    canManage && editMode
      ? "p-0"
      : feedMediaGrid
        ? "px-3 sm:px-5 pt-3 pb-0 sm:pt-4"
        : "px-3 sm:px-5 py-3 sm:py-5";

  /** В режиме редактирования `overflow-hidden` на iOS ломает scrollIntoView и клавиатуру. */
  const articleClip =
    canManage && editMode ? "overflow-x-hidden" : "overflow-hidden";

  /** Полноэкранная ссылка на пост: текст/шапка не перехватывают hit-test (кроме кнопок и фото). */
  const showPostLinkOverlay = !standalone && !(canManage && editMode);

  return (
    <>
      <article
        className={`relative min-w-0 scroll-mt-24 ${articleClip} rounded-[24px] border border-stone-200/80 bg-white/95 shadow-[0_8px_30px_-10px_rgba(60,44,29,0.15)] backdrop-blur-sm sm:rounded-[30px] ${articlePad}`}
      >
        {showPostLinkOverlay ? (
          <PostOpenLinkOverlay href={postUrl} ariaLabel={openPostAria} />
        ) : null}

        <div
          className={`relative z-[1] min-w-0 ${
            showPostLinkOverlay ? "pointer-events-none" : ""
          }`}
        >
        {plausibleDomain || yandexMetrikaId?.trim() ? (
          <PostImpression
            slug={post.slug}
            plausibleDomain={plausibleDomain}
            yandexMetrikaId={yandexMetrikaId}
          />
        ) : null}

        <header
          className={`relative flex items-center justify-between gap-3 ${
            showPostLinkOverlay ? "pointer-events-none" : ""
          } ${
            canManage && editMode
              ? "border-b border-stone-100 px-3 pb-2.5 pt-3 sm:px-5 sm:pb-3 sm:pt-4"
              : feedMediaGrid
                ? "mb-2 sm:mb-3"
                : "mb-4"
          }`}
        >
          <div
            className={
              showPostLinkOverlay
                ? "min-w-0 flex flex-col gap-0.5 pointer-events-none [&_*]:pointer-events-none"
                : "min-w-0 flex flex-col gap-0.5"
            }
          >
            <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-stone-400">
              {post.publishedAt ? (
                <time suppressHydrationWarning dateTime={post.publishedAt}>
                  {formatDate(post.publishedAt)}
                </time>
              ) : (
                <span className="text-amber-600">Черновик</span>
              )}
              {pinnedUi ? (
                <span className="h-1 w-1 rounded-full bg-stone-300" />
              ) : null}
              {pinnedUi ? (
                <span className="text-amber-700">Закреплено</span>
              ) : null}
            </div>
            {post.category?.name?.trim() ? (
              standalone ? (
                <Link
                  href={`/category/${encodeURIComponent(post.category.slug)}`}
                  scroll={false}
                  prefetch
                  className="inline-flex w-fit text-[13px] font-medium leading-snug text-stone-400 transition hover:text-stone-600"
                >
                  {post.category.name.trim().toLocaleLowerCase("ru-RU")}
                </Link>
              ) : (
                <span className="text-[13px] font-medium leading-snug text-stone-400">
                  {post.category.name.trim().toLocaleLowerCase("ru-RU")}
                </span>
              )
            ) : null}
            {canManage && editMode ? (
              <span className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                Редактирование
              </span>
            ) : null}
          </div>

          <div
            className={`flex shrink-0 items-center gap-1.5 ${
              showPostLinkOverlay ? "pointer-events-auto" : ""
            }`}
          >
            {canManage && editMode ? (
              <button
                type="button"
                aria-label="Закрыть редактирование"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition active:scale-90"
                onClick={() => cancelEdit()}
              >
                <X size={18} />
              </button>
            ) : canManage ? (
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
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-stone-700 hover:bg-stone-50 active:bg-stone-100 disabled:opacity-50"
                          role="menuitem"
                          onClick={() => void togglePin()}
                        >
                          {pinnedUi ? (
                            <PinOff size={16} className="text-stone-400" />
                          ) : (
                            <Pin size={16} className="text-stone-400" />
                          )}
                          {pinnedUi ? "Открепить" : "Закрепить"}
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
                        <div className="my-1.5 h-px bg-stone-100" />
                        {!standalone ? (
                          <Link
                            href={postUrl}
                            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-stone-700 hover:bg-stone-50 active:bg-stone-100"
                            onClick={() => setMenuOpen(false)}
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
                          <ShareForwardIcon
                            size={16}
                            className="text-stone-400"
                          />
                          Поделиться
                        </button>
                      </div>,
                      document.body,
                    )
                  : null}
              </div>
            ) : (
              <button
                type="button"
                aria-label="Поделиться"
                title="Поделиться"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition active:scale-90"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  sharePost();
                }}
              >
                <ShareForwardIcon size={20} className="text-stone-700" />
              </button>
            )}
          </div>
        </header>

        {canManage && editMode ? (
          <div className="px-3 pb-2 pt-2 sm:px-5 sm:pb-2 sm:pt-3">
          <FeedComposerPanelLazy
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
            uploadFiles={(files) => addUploadFiles(files)}
            working={working}
            message={editMessage}
            uploadBlocksSubmit={uploadBlocksSubmit}
            uploadQueue={{
              rows: uploadRows,
              doneCount: uploadDoneCount,
              totalPlanned: uploadTotalPlanned,
              isProcessing: uploadIsProcessing,
              onStop: stopUpload,
              onRetry: retryUpload,
              onDismissCancelled: dismissCancelledUploads,
            }}
            onSubmitDraft={() => void saveEdit("DRAFT")}
            onSubmitPublish={() => void saveEdit("PUBLISHED")}
            canSubmit={
              editBody.trim().length > 0 || editImages.length > 0
            }
            publishLabel={post.publishedAt ? "Сохранить" : "Опубликовать"}
            categories={
              categories.length > 0
                ? categories.map((c) => ({
                    id: c.id,
                    name: c.name,
                    slug: c.slug,
                  }))
                : undefined
            }
            postCategoryId={
              categories.length > 0 ? editCategoryId : undefined
            }
            onPostCategoryChange={
              categories.length > 0 ? setEditCategoryId : undefined
            }
          />
          </div>
        ) : (
          <>
            {standalone && standaloneTitle ? (
              <h2
                className={`mb-2.5 text-xl font-semibold leading-tight tracking-tight text-stone-900 sm:mb-3 sm:text-2xl ${
                  showPostLinkOverlay ? "pointer-events-none" : ""
                }`}
              >
                {standaloneTitle}
              </h2>
            ) : null}
            {postBodyForRender ? (
              <div
                className={`min-w-0 whitespace-pre-wrap text-[15px] leading-relaxed text-stone-800 sm:text-[16px] sm:leading-8 ${
                  showPostLinkOverlay ? "pointer-events-none" : ""
                } ${feedMediaGrid ? "mb-2 sm:mb-2.5" : "mb-3 sm:mb-5"}`}
              >
                {postBodyForRender}
              </div>
            ) : null}
            {!standalone ? (
              <div
                className={`${
                  postBodyForRender ? "mb-3 sm:mb-4 -mt-1" : "mb-2 sm:mb-2.5"
                }`}
              >
                <Link
                  href={postUrl}
                  prefetch
                  aria-label={openPostAria}
                  className="pointer-events-auto relative z-[2] inline-flex items-center text-[11px] font-medium text-stone-400 transition hover:text-stone-600"
                >
                  Открыть пост
                </Link>
              </div>
            ) : null}

            {!standalone && post.images.length > 0 ? (
              <div className="pointer-events-auto min-w-0">
                <MediaGrid
                  fullBleed
                  flushCardBottom
                  layoutSeed={post.id}
                  eagerCount={prioritizeMedia ? 1 : 0}
                  images={post.images.map((image) => ({
                    id: image.id,
                    ...buildFeedGridSources(image.variants),
                    sizes:
                      "(max-width: 640px) 100vw, (max-width: 1100px) 92vw, 768px",
                    alt: image.alt || post.title,
                    width: image.width,
                    height: image.height,
                  }))}
                  onImageClick={(index) => setViewerIndex(index)}
                />
              </div>
            ) : (
              <div className="pointer-events-auto min-w-0 space-y-3 sm:space-y-4">
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
                      width={im.width}
                      height={im.height}
                      priority={prioritizeMedia && i === 0}
                      className="rounded-xl sm:rounded-[14px]"
                    />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        </div>
      </article>

      {viewerIndex !== null && lightboxSlides[viewerIndex]?.src ? (
        <ImageLightbox
          slides={lightboxSlides}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onIndexChange={setViewerIndex}
        />
      ) : null}
    </>
  );
}
