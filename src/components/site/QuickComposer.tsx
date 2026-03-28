"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import {
  FeedComposerPanel,
  type FeedComposerImage,
} from "@/components/feed/FeedComposerPanel";
import { dispatchFeedRefreshMerge } from "@/lib/feed-refresh";
import { useFeedImageUploadQueue } from "@/hooks/use-feed-image-upload-queue";
import type { FeedCategory } from "@/types/feed";

async function ensureDraft(postId: string | null) {
  if (postId) return postId;
  const res = await fetch("/api/admin/posts", { method: "POST" });
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
    onQueueError: (msg) => setMessage(msg),
  });

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
    await fetch(`/api/admin/images/${imageId}`, { method: "DELETE" });
    setImages((prev) => prev.filter((item) => item.id !== imageId));
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
        dispatchFeedRefreshMerge();
        router.refresh();
      } else {
        setMessage("Черновик сохранён");
      }
    } finally {
      setWorking(false);
    }
  }

  return (
    <FeedComposerPanel
      className="mb-6"
      headerLeft="Новая публикация"
      headerRight={
        <a
          href="/admin/posts"
          className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800"
        >
          <Settings size={14} />
          Админка
        </a>
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
    />
  );
}
