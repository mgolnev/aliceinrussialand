"use client";

import dynamic from "next/dynamic";
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
import {
  Copy,
  Edit3,
  ExternalLink,
  EyeOff,
  ImageIcon,
  MoreHorizontal,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { POST_STATUS } from "@/lib/constants";
import {
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
import type { FeedCategory, FeedPost } from "@/types/feed";
import { LinkPendingBackdrop } from "@/components/ui/LinkPendingBackdrop";
import {
  handleMobileEditableBlur,
  handleMobileEditableFocus,
} from "@/lib/mobile-editable-scroll";
import type { AdminPostListRow } from "@/components/admin/admin-post-list-types";

const FeedComposerPanelLazy = dynamic(
  () =>
    import("@/components/feed/FeedComposerPanel").then((m) => ({
      default: m.FeedComposerPanel,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="mx-0 mb-3 h-40 animate-pulse rounded-2xl bg-stone-100"
        aria-hidden
      />
    ),
  },
);

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

function previewInner(p: AdminPostListRow, published: boolean) {
  const metaDate = formatMetaDate(p.publishedAt, p.updatedAt);
  const statusLabel = published ? "Опубликовано" : "Черновик";
  return (
    <>
      <div className="relative z-[1] box-border flex h-full min-h-0 shrink-0 items-center self-stretch py-1 pl-0 pr-0 sm:py-1.5">
        <div className="relative h-[4.75rem] w-[4.75rem] shrink-0 sm:h-[5.25rem] sm:w-[5.25rem]">
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
                published ? "bg-emerald-500/45" : "bg-stone-400/45"
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
    </>
  );
}

export function AdminPostRow({
  post: p,
  siteUrl,
  categories,
}: {
  post: AdminPostListRow;
  siteUrl: string;
  categories: FeedCategory[];
}) {
  const router = useRouter();
  const base = siteUrl.replace(/\/$/, "");
  const published = p.status === POST_STATUS.PUBLISHED;

  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(
    null,
  );

  const [editMode, setEditMode] = useState(false);
  const [fetchingEdit, setFetchingEdit] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedPost, setFeedPost] = useState<FeedPost | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editImages, setEditImages] = useState<FeedPost["images"]>([]);
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [editSlug, setEditSlug] = useState("");
  const [editMetaTitle, setEditMetaTitle] = useState("");
  const [editMetaDescription, setEditMetaDescription] = useState("");
  const [editMessage, setEditMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const updateMenuPosition = useCallback(() => {
    const el = menuTriggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 8;
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

  useEffect(() => {
    if (editMode) setMenuOpen(false);
  }, [editMode]);

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

  const resolveComposerPostId = useCallback(async () => p.id, [p.id]);

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

  async function startEdit() {
    setMenuOpen(false);
    setLoadError(null);
    setEditMessage(null);
    setEditMode(true);
    setFetchingEdit(true);
    setFeedPost(null);
    try {
      const res = await fetch(`/api/admin/posts/${p.id}`, {
        ...adminCredentials,
      });
      const data = await readAdminResponseJson(res);
      if (!res.ok) {
        const err =
          data &&
          typeof data === "object" &&
          typeof (data as { error?: string }).error === "string"
            ? (data as { error: string }).error
            : "Не удалось загрузить пост";
        setLoadError(err);
        setEditMode(false);
        return;
      }
      const feed = feedPostFromAdminPatchJson(data);
      if (!feed) {
        setLoadError("Некорректный ответ сервера");
        setEditMode(false);
        return;
      }
      const raw = data as Record<string, unknown>;
      setFeedPost(feed);
      setEditBody(feed.body);
      setEditImages(feed.images);
      setEditCategoryId(feed.categoryId);
      setEditSlug(typeof raw.slug === "string" ? raw.slug : feed.slug);
      setEditMetaTitle(
        typeof raw.metaTitle === "string" ? raw.metaTitle : "",
      );
      setEditMetaDescription(
        typeof raw.metaDescription === "string"
          ? raw.metaDescription
          : "",
      );
    } catch {
      setLoadError("Ошибка сети");
      setEditMode(false);
    } finally {
      setFetchingEdit(false);
    }
  }

  function cancelEdit() {
    setEditMode(false);
    setEditMessage(null);
    setLoadError(null);
    setFeedPost(null);
    setFetchingEdit(false);
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

  async function saveEdit(status: "DRAFT" | "PUBLISHED") {
    if (!feedPost) return;
    setWorking(true);
    setEditMessage(null);
    const controller = new AbortController();
    const killSlow = window.setTimeout(() => controller.abort(), 90_000);
    const payload: Record<string, unknown> = {
      title: "",
      body: editBody,
      displayMode: feedPost.displayMode,
      status,
      categoryId: editCategoryId,
      slug: editSlug.trim(),
      metaTitle: editMetaTitle.trim(),
      metaDescription: editMetaDescription.trim(),
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
      const res = await fetch(`/api/admin/posts/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        ...adminCredentials,
        signal: controller.signal,
      });
      const data = await readAdminResponseJson(res);
      if (res.ok) {
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
          ? "Сервер долго не отвечает — попробуйте снова."
          : "Нет сети или запрос сброшен.",
      );
    } finally {
      window.clearTimeout(killSlow);
      setWorking(false);
    }
  }

  const patchStatus = useCallback(
    async (status: string) => {
      setBusy(true);
      try {
        const res = await fetch(`/api/admin/posts/${p.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
          ...adminCredentials,
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
      const res = await fetch(`/api/admin/posts/${p.id}`, {
        method: "DELETE",
        ...adminCredentials,
      });
      if (!res.ok) return;
      setMenuOpen(false);
      dispatchFeedRefreshReplace();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }, [p.id, router]);

  const rowPreviewClass =
    "relative flex min-h-0 min-w-0 flex-1 items-stretch gap-3 py-2 pl-3 pr-1 transition-[colors,transform] sm:gap-4 sm:py-2.5 sm:pl-4 sm:pr-2 group-hover:bg-stone-50/95";

  return (
    <li className="touch-manipulation overflow-visible border-b border-stone-200/50 last:border-b-0">
      <div className="group flex min-h-[5rem] items-stretch overflow-visible sm:min-h-[5.25rem]">
        {published && !editMode ? (
          <Link
            href={`/p/${p.slug}`}
            className={`${rowPreviewClass} motion-safe:active:scale-[0.995] motion-safe:active:bg-stone-100/80`}
          >
            <LinkPendingBackdrop />
            {previewInner(p, published)}
          </Link>
        ) : (
          <div
            className={`${rowPreviewClass} ${editMode ? "pointer-events-none opacity-80" : ""}`}
            aria-hidden={editMode}
          >
            {previewInner(p, published)}
          </div>
        )}

        {!editMode ? (
          <div className="relative z-10 flex w-11 shrink-0 flex-col items-center justify-center self-stretch border-l border-stone-200/40 bg-white/80 group-hover:bg-stone-50/90 sm:w-12">
            <button
              ref={menuTriggerRef}
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition active:scale-90"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Действия"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
            >
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && menuPos
              ? createPortal(
                  <div
                    ref={menuPanelRef}
                    className="fixed z-[200] w-56 overflow-hidden rounded-2xl border border-stone-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: menuPos.top, right: menuPos.right }}
                    role="menu"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-stone-700 hover:bg-stone-50 active:bg-stone-100"
                      role="menuitem"
                      disabled={busy || fetchingEdit}
                      onClick={() => void startEdit()}
                    >
                      <Edit3 size={16} className="text-stone-400" />
                      Редактировать
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-stone-700 hover:bg-stone-50 active:bg-stone-100"
                      role="menuitem"
                      disabled={busy}
                      onClick={() => {
                        setMenuOpen(false);
                        void navigator.clipboard
                          .writeText(`${base}/p/${p.slug}`)
                          .catch(() => {});
                      }}
                    >
                      <Copy size={16} className="text-stone-400" />
                      Копировать URL
                    </button>
                    {published ? (
                      <Link
                        href={`/p/${p.slug}`}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-stone-700 hover:bg-stone-50 active:bg-stone-100"
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                      >
                        <ExternalLink size={16} className="text-stone-400" />
                        Открыть на сайте
                      </Link>
                    ) : null}
                    <div className="my-1.5 h-px bg-stone-100" />
                    {published ? (
                      <button
                        type="button"
                        disabled={busy}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-stone-700 hover:bg-stone-50 active:bg-stone-100 disabled:opacity-50"
                        role="menuitem"
                        onClick={() => void patchStatus(POST_STATUS.DRAFT)}
                      >
                        <EyeOff size={16} className="text-stone-400" />
                        В черновики
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-stone-700 hover:bg-stone-50 active:bg-stone-100 disabled:opacity-50"
                        role="menuitem"
                        onClick={() =>
                          void patchStatus(POST_STATUS.PUBLISHED)
                        }
                      >
                        <Send size={16} className="text-stone-400" />
                        Опубликовать
                      </button>
                    )}
                    <div className="my-1.5 h-px bg-stone-100" />
                    <button
                      type="button"
                      disabled={busy}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-red-600 hover:bg-red-50 active:bg-red-100 disabled:opacity-50"
                      role="menuitem"
                      onClick={() => void deletePost()}
                    >
                      <Trash2 size={16} className="text-red-400" />
                      Удалить
                    </button>
                  </div>,
                  document.body,
                )
              : null}
          </div>
        ) : null}
      </div>

      {editMode ? (
        <div className="border-t border-stone-200/60 bg-white px-3 py-3 sm:px-4 sm:py-4">
          {fetchingEdit ? (
            <div className="h-44 animate-pulse rounded-2xl bg-stone-100" />
          ) : loadError ? (
            <p className="text-sm text-red-600" role="alert">
              {loadError}
            </p>
          ) : feedPost ? (
            <>
              <header className="mb-3 flex items-center justify-between gap-3 border-b border-stone-100 pb-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Редактирование
                </span>
                <button
                  type="button"
                  aria-label="Закрыть редактирование"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition active:scale-90"
                  disabled={working}
                  onClick={() => cancelEdit()}
                >
                  <X size={18} />
                </button>
              </header>

              <details className="mb-3 rounded-xl border border-stone-200/80 bg-stone-50/50 px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium text-stone-800">
                  Slug и SEO
                </summary>
                <div className="mt-3 space-y-3 pb-1">
                  <label className="block text-[14px] font-medium text-stone-800">
                    Slug (путь URL)
                    <input
                      className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 font-mono text-[14px] outline-none focus:border-stone-400"
                      value={editSlug}
                      onChange={(e) => setEditSlug(e.target.value)}
                      disabled={working}
                      autoComplete="off"
                      onFocus={handleMobileEditableFocus}
                      onBlur={handleMobileEditableBlur}
                    />
                  </label>
                  <label className="block text-[14px] font-medium text-stone-800">
                    SEO title
                    <input
                      className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-[14px] outline-none focus:border-stone-400"
                      value={editMetaTitle}
                      onChange={(e) => setEditMetaTitle(e.target.value)}
                      disabled={working}
                      placeholder="Пусто — подставится заголовок поста"
                      onFocus={handleMobileEditableFocus}
                      onBlur={handleMobileEditableBlur}
                    />
                  </label>
                  <label className="block text-[14px] font-medium text-stone-800">
                    SEO description
                    <textarea
                      className="mt-1 min-h-[100px] w-full rounded-xl border border-stone-300 px-3 py-2.5 text-[14px] leading-snug outline-none focus:border-stone-400"
                      style={{ fontSize: "max(14px, 0.875rem)" }}
                      value={editMetaDescription}
                      onChange={(e) =>
                        setEditMetaDescription(e.target.value)
                      }
                      disabled={working}
                      placeholder="Пусто — возьмётся начало текста"
                      onFocus={handleMobileEditableFocus}
                      onBlur={handleMobileEditableBlur}
                    />
                  </label>
                </div>
              </details>

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
                publishLabel={
                  feedPost.publishedAt ? "Сохранить" : "Опубликовать"
                }
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
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
