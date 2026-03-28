"use client";

import { useCallback, useRef, useState } from "react";
import { nanoid } from "nanoid";
import { readAdminResponseJson } from "@/lib/admin-fetch";

/** Ответ POST /api/admin/upload — совместим с FeedComposerImage */
export type UploadedFeedImage = {
  id: string;
  variants: Record<string, string>;
  width?: number | null;
  height?: number | null;
  caption?: string;
  alt?: string;
};

export type UploadQueueRowStatus =
  | "pending"
  | "uploading"
  | "error"
  | "cancelled";

export type UploadQueueRow = {
  clientId: string;
  previewUrl: string;
  label: string;
  status: UploadQueueRowStatus;
  errorMessage?: string;
};

type InternalItem = UploadQueueRow & { file: File };

export type UseFeedImageUploadQueueOptions = {
  onImageUploaded: (image: UploadedFeedImage) => void;
  resolvePostId: () => Promise<string>;
  fetchInit?: RequestInit;
  onQueueError?: (message: string) => void;
};

function fileLabel(file: File, index: number) {
  const name = file.name?.trim();
  if (name) {
    return name.length > 36 ? `${name.slice(0, 34)}…` : name;
  }
  return `Фото ${index + 1}`;
}

export function useFeedImageUploadQueue({
  onImageUploaded,
  resolvePostId,
  fetchInit,
  onQueueError,
}: UseFeedImageUploadQueueOptions) {
  const [rows, setRows] = useState<UploadQueueRow[]>([]);
  const [doneCount, setDoneCount] = useState(0);
  const [totalPlanned, setTotalPlanned] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const queueRef = useRef<InternalItem[]>([]);
  const totalPlannedRef = useRef(0);
  const stopRequestedRef = useRef(false);
  const runningRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const postIdRef = useRef<string | null>(null);

  const syncRowsFromRef = useCallback(() => {
    setRows(
      queueRef.current.map(({ clientId, previewUrl, label, status, errorMessage }) => ({
        clientId,
        previewUrl,
        label,
        status,
        errorMessage,
      })),
    );
  }, []);

  const revokePreview = useCallback((url: string) => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }, []);

  const removeItemById = useCallback(
    (clientId: string) => {
      const item = queueRef.current.find((i) => i.clientId === clientId);
      if (item) revokePreview(item.previewUrl);
      queueRef.current = queueRef.current.filter((i) => i.clientId !== clientId);
      syncRowsFromRef();
    },
    [revokePreview, syncRowsFromRef],
  );

  const updateItem = useCallback(
    (clientId: string, patch: Partial<Pick<InternalItem, "status" | "errorMessage">>) => {
      queueRef.current = queueRef.current.map((i) =>
        i.clientId === clientId ? { ...i, ...patch } : i,
      );
      syncRowsFromRef();
    },
    [syncRowsFromRef],
  );

  const runProcessor = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setIsProcessing(true);

    try {
      let postId = postIdRef.current;
      if (!postId) {
        try {
          postId = await resolvePostId();
          postIdRef.current = postId;
        } catch {
          onQueueError?.("Не удалось подготовить пост для загрузки");
          queueRef.current = queueRef.current.map((i) =>
            i.status === "pending" || i.status === "uploading"
              ? {
                  ...i,
                  status: "error" as const,
                  errorMessage: "Нет поста для вложения",
                }
              : i,
          );
          syncRowsFromRef();
          return;
        }
      }

      while (!stopRequestedRef.current) {
        const next = queueRef.current.find((i) => i.status === "pending");
        if (!next) break;

        updateItem(next.clientId, { status: "uploading", errorMessage: undefined });

        const ac = new AbortController();
        abortRef.current = ac;

        try {
          const fd = new FormData();
          fd.set("postId", postId);
          fd.set("file", next.file);

          const res = await fetch("/api/admin/upload", {
            method: "POST",
            body: fd,
            signal: ac.signal,
            ...fetchInit,
          });

          if (!res.ok) {
            const parsed = (await readAdminResponseJson(res)) as {
              error?: string;
            } | null;
            const msg =
              typeof parsed?.error === "string"
                ? parsed.error
                : `Ошибка ${res.status}`;
            updateItem(next.clientId, { status: "error", errorMessage: msg });
            continue;
          }

          const image = (await res.json()) as UploadedFeedImage;
          removeItemById(next.clientId);
          setDoneCount((c) => c + 1);
          onImageUploaded(image);
        } catch (e) {
          const aborted =
            e instanceof Error &&
            (e.name === "AbortError" || e.message === "AbortError");
          if (aborted) {
            if (stopRequestedRef.current) {
              updateItem(next.clientId, {
                status: "cancelled",
                errorMessage: "Остановлено",
              });
              break;
            }
            updateItem(next.clientId, {
              status: "error",
              errorMessage: "Соединение прервано",
            });
            continue;
          }
          const msg =
            e instanceof Error ? e.message : "Нет сети или сбой соединения";
          updateItem(next.clientId, { status: "error", errorMessage: msg });
        }
      }

      if (stopRequestedRef.current) {
        queueRef.current = queueRef.current.map((i) => {
          if (i.status === "pending") {
            return { ...i, status: "cancelled" as const, errorMessage: "Остановлено" };
          }
          return i;
        });
        syncRowsFromRef();
      }
    } finally {
      runningRef.current = false;
      abortRef.current = null;
      const hasWork = queueRef.current.some(
        (i) => i.status === "pending" || i.status === "uploading",
      );
      setIsProcessing(hasWork);
    }
  }, [
    fetchInit,
    onImageUploaded,
    onQueueError,
    removeItemById,
    resolvePostId,
    syncRowsFromRef,
    updateItem,
  ]);

  const addUploadFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      stopRequestedRef.current = false;

      const list = Array.from(files);
      const startIndex = totalPlannedRef.current;
      totalPlannedRef.current += list.length;
      setTotalPlanned(totalPlannedRef.current);

      const newItems: InternalItem[] = list.map((file, i) => ({
        clientId: nanoid(),
        file,
        previewUrl: URL.createObjectURL(file),
        label: fileLabel(file, startIndex + i),
        status: "pending" as const,
      }));

      queueRef.current = [...queueRef.current, ...newItems];
      syncRowsFromRef();
      void runProcessor();
    },
    [runProcessor, syncRowsFromRef],
  );

  const stopUpload = useCallback(() => {
    stopRequestedRef.current = true;
    abortRef.current?.abort();
  }, []);

  const retryUpload = useCallback(
    (clientId: string) => {
      stopRequestedRef.current = false;
      const item = queueRef.current.find((i) => i.clientId === clientId);
      if (!item || item.status !== "error") return;
      updateItem(clientId, { status: "pending", errorMessage: undefined });
      void runProcessor();
    },
    [runProcessor, updateItem],
  );

  const dismissCancelledUploads = useCallback(() => {
    const toRemove = queueRef.current.filter((i) => i.status === "cancelled");
    for (const i of toRemove) revokePreview(i.previewUrl);
    queueRef.current = queueRef.current.filter((i) => i.status !== "cancelled");
    syncRowsFromRef();
  }, [revokePreview, syncRowsFromRef]);

  const resetUploadProgressIfIdle = useCallback(() => {
    if (queueRef.current.length === 0 && !runningRef.current) {
      setDoneCount(0);
      totalPlannedRef.current = 0;
      setTotalPlanned(0);
      postIdRef.current = null;
    }
  }, []);

  const clearUploadSession = useCallback(() => {
    queueRef.current.forEach((i) => revokePreview(i.previewUrl));
    queueRef.current = [];
    syncRowsFromRef();
    setDoneCount(0);
    totalPlannedRef.current = 0;
    setTotalPlanned(0);
    postIdRef.current = null;
    stopRequestedRef.current = false;
    setIsProcessing(false);
  }, [revokePreview, syncRowsFromRef]);

  return {
    uploadRows: rows,
    uploadDoneCount: doneCount,
    uploadTotalPlanned: totalPlanned,
    uploadIsProcessing: isProcessing,
    addUploadFiles,
    stopUpload,
    retryUpload,
    dismissCancelledUploads,
    resetUploadProgressIfIdle,
    clearUploadSession,
  };
}
