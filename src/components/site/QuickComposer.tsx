"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Settings, X } from "lucide-react";
import type { FeedComposerImage } from "@/components/feed/FeedComposerPanel";
import type { TelegramPickItem } from "@/components/feed/TelegramComposerPickSheet";
import { dispatchFeedRefreshMerge } from "@/lib/feed-refresh";
import { useFeedImageUploadQueue } from "@/hooks/use-feed-image-upload-queue";
import { adminCredentials, readAdminResponseJson } from "@/lib/admin-fetch";
import { normalizeTelegramPostUrl } from "@/lib/telegram-post-url";
import type { FeedCategory } from "@/types/feed";

const TG_IMPORT_HINT =
  "Черновик из Telegram: дата на сайте совпадает с датой поста в канале (если она была в ленте). Текст и фото можно менять.";

const FeedComposerPanelLazy = dynamic(
  () =>
    import("@/components/feed/FeedComposerPanel").then((m) => ({
      default: m.FeedComposerPanel,
    })),
  {
    ssr: false,
  },
);

const TelegramComposerPickSheetLazy = dynamic(
  () =>
    import("@/components/feed/TelegramComposerPickSheet").then((m) => ({
      default: m.TelegramComposerPickSheet,
    })),
  {
    ssr: false,
  },
);

async function ensureDraft(postId: string | null) {
  if (postId) return postId;
  const res = await fetch("/api/admin/posts", {
    method: "POST",
    ...adminCredentials,
  });
  const data = (await res.json()) as { id: string };
  return data.id;
}

export function QuickComposer({ categories }: { categories: FeedCategory[] }) {
  const router = useRouter();
  const [postId, setPostId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [images, setImages] = useState<FeedComposerImage[]>([]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tgSheetOpen, setTgSheetOpen] = useState(false);
  const [importHint, setImportHint] = useState<string | null>(null);
  const [replaceItem, setReplaceItem] = useState<TelegramPickItem | null>(null);
  /** URL постов, импортированных из листа в этой сессии (пометка «уже импортировано»). */
  const [sessionTgImported, setSessionTgImported] = useState<string[]>([]);
  /** После «В черновик» не удаляем пост с сервера при очистке редактора. */
  const [draftCommittedToServer, setDraftCommittedToServer] = useState(false);

  const canSubmit = body.trim().length > 0 || images.length > 0;

  const onImageUploaded = useCallback((image: FeedComposerImage) => {
    setImages((prev) => [...prev, image]);
  }, []);

  const resolvePostId = useCallback(async () => {
    const id = await ensureDraft(postId);
    setPostId(id);
    return id;
  }, [postId]);

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
    onImageUploaded,
    resolvePostId,
    fetchInit: adminCredentials,
    onQueueError: (msg) => setMessage(msg),
  });

  const showComposerDismiss =
    canSubmit ||
    Boolean(importHint) ||
    Boolean(postId) ||
    uploadRows.length > 0;

  useEffect(() => {
    if (
      uploadRows.length === 0 &&
      !uploadIsProcessing &&
      uploadDoneCount > 0
    ) {
      const t = window.setTimeout(() => resetUploadProgressIfIdle(), 1800);
      return () => window.clearTimeout(t);
    }
  }, [
    uploadRows.length,
    uploadIsProcessing,
    uploadDoneCount,
    resetUploadProgressIfIdle,
  ]);

  const uploadBlocksSubmit =
    uploadIsProcessing ||
    uploadRows.some(
      (r) => r.status === "pending" || r.status === "uploading",
    );

  async function removeImage(imageId: string) {
    await fetch(`/api/admin/images/${imageId}`, {
      method: "DELETE",
      ...adminCredentials,
    });
    setImages((prev) => prev.filter((item) => item.id !== imageId));
  }

  async function runHydrateFromTelegram(
    item: TelegramPickItem,
    opts: { replaceExisting: boolean },
  ) {
    setWorking(true);
    setMessage(null);
    try {
      const existingPostId =
        opts.replaceExisting
          ? postId
          : postId && !canSubmit
            ? postId
            : null;

      const res = await fetch("/api/admin/telegram/hydrate-composer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: {
            href: item.href,
            text: item.text,
            imageUrls: item.imageUrls,
            dateIso: item.dateIso,
          },
          existingPostId,
        }),
        ...adminCredentials,
      });
      const data = (await readAdminResponseJson(res)) as {
        id?: string;
        body?: string;
        images?: FeedComposerImage[];
        error?: string;
      };
      if (!res.ok) {
        setMessage(data.error ?? "Не удалось импортировать пост");
        return;
      }
      const hrefNorm = normalizeTelegramPostUrl(item.href);
      if (hrefNorm) {
        setSessionTgImported((prev) => [...new Set([...prev, hrefNorm])]);
      }
      clearUploadSession();
      setPostId(data.id ?? null);
      setBody(data.body ?? "");
      setImages(data.images ?? []);
      setCategoryId(null);
      setDraftCommittedToServer(false);
      setImportHint(TG_IMPORT_HINT);
      setTgSheetOpen(false);
      dispatchFeedRefreshMerge();
      router.refresh();
    } finally {
      setWorking(false);
    }
  }

  function onTelegramItemChosen(item: TelegramPickItem) {
    if (canSubmit) {
      setTgSheetOpen(false);
      setReplaceItem(item);
      return;
    }
    return runHydrateFromTelegram(item, { replaceExisting: false });
  }

  async function discardComposer() {
    if (working) return;
    stopUpload();

    const id = postId;
    const shouldDeleteServer = Boolean(id) && !draftCommittedToServer;

    if (shouldDeleteServer) {
      setWorking(true);
      setMessage(null);
      try {
        const res = await fetch(`/api/admin/posts/${id}`, {
          method: "DELETE",
          ...adminCredentials,
        });
        const data = (await readAdminResponseJson(res).catch(() => null)) as
          | { error?: string }
          | null;
        if (!res.ok) {
          setMessage(data?.error ?? "Не удалось удалить черновик");
          return;
        }
        dispatchFeedRefreshMerge();
        router.refresh();
      } finally {
        setWorking(false);
      }
    }

    clearUploadSession();
    setBody("");
    setImages([]);
    setCategoryId(null);
    setPostId(null);
    setMessage(null);
    setImportHint(null);
    setDraftCommittedToServer(false);
  }

  async function submit(status: "DRAFT" | "PUBLISHED") {
    if (!canSubmit) return;
    setWorking(true);
    setMessage(null);
    try {
      const ensuredId = await ensureDraft(postId);
      setPostId(ensuredId);

      const res = await fetch(`/api/admin/posts/${ensuredId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "",
          body,
          displayMode: "GRID",
          status,
          categoryId,
          images: images.map((image, index) => ({
            id: image.id,
            sortOrder: index,
          })),
        }),
        ...adminCredentials,
      });

      const data = (await res.json().catch(() => null)) as
        | { slug?: string; error?: string }
        | null;

      if (!res.ok) {
        setMessage(data?.error ?? "Не удалось сохранить пост");
        return;
      }

      if (status === "PUBLISHED" && data?.slug) {
        clearUploadSession();
        setBody("");
        setImages([]);
        setCategoryId(null);
        setPostId(null);
        setMessage(null);
        setImportHint(null);
        setDraftCommittedToServer(false);
        dispatchFeedRefreshMerge();
        router.refresh();
      } else {
        setDraftCommittedToServer(true);
        setMessage("Черновик сохранён");
      }
    } finally {
      setWorking(false);
    }
  }

  return (
    <>
      <FeedComposerPanelLazy
        className="mb-6"
        headerLeft="Новая публикация"
        headerRight={
          <>
            <a
              href="/admin/posts"
              className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800"
            >
              <Settings size={14} />
              Админка
            </a>
            {showComposerDismiss ? (
              <button
                type="button"
                aria-label={
                  draftCommittedToServer
                    ? "Очистить редактор (черновик останется в админке)"
                    : "Закрыть редактор и удалить несохранённый черновик"
                }
                title={
                  draftCommittedToServer
                    ? "Очистить поля — черновик в админке сохранится"
                    : "Сбросить заготовку и удалить черновик с сервера"
                }
                disabled={working}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm transition active:scale-90 disabled:opacity-50"
                onClick={() => void discardComposer()}
              >
                <X size={18} aria-hidden />
              </button>
            ) : null}
          </>
        }
        body={body}
        onBodyChange={setBody}
        images={images}
        onImagesChange={setImages}
        onRemoveImage={(id) => void removeImage(id)}
        uploadFiles={(files) => addUploadFiles(files)}
        working={working}
        message={message}
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
        onSubmitDraft={() => void submit("DRAFT")}
        onSubmitPublish={() => void submit("PUBLISHED")}
        canSubmit={canSubmit}
        categories={
          categories.length > 0
            ? categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))
            : undefined
        }
        postCategoryId={categories.length > 0 ? categoryId : undefined}
        onPostCategoryChange={
          categories.length > 0 ? setCategoryId : undefined
        }
        quickAddMenu
        onRequestTelegramImport={() => setTgSheetOpen(true)}
        importSourceHint={importHint}
      />

      <TelegramComposerPickSheetLazy
        open={tgSheetOpen}
        onClose={() => setTgSheetOpen(false)}
        onSelect={(item) => onTelegramItemChosen(item)}
        sessionImportedHrefs={sessionTgImported}
      />

      {replaceItem ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          role="alertdialog"
          aria-labelledby="replace-draft-title"
          aria-describedby="replace-draft-desc"
          onClick={(e) => {
            if (e.target === e.currentTarget) setReplaceItem(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-t-2xl border border-stone-200 bg-white p-5 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="replace-draft-title"
              className="text-lg font-semibold text-stone-900"
            >
              Заменить черновик?
            </h3>
            <p
              id="replace-draft-desc"
              className="mt-2 text-sm leading-relaxed text-stone-600"
            >
              В редакторе уже есть текст или фото. Импорт из Telegram заменит
              их содержимым выбранного поста.
            </p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="rounded-full border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-800 hover:bg-stone-50"
                onClick={() => setReplaceItem(null)}
              >
                Отменить
              </button>
              <button
                type="button"
                className="rounded-full bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-stone-800"
                onClick={() => {
                  const item = replaceItem;
                  setReplaceItem(null);
                  if (item) void runHydrateFromTelegram(item, { replaceExisting: true });
                }}
              >
                Заменить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
