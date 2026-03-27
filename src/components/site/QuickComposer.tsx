"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings } from "lucide-react";
import {
  FeedComposerPanel,
  type FeedComposerImage,
} from "@/components/feed/FeedComposerPanel";
import { dispatchFeedRefreshMerge } from "@/lib/feed-refresh";

async function ensureDraft(postId: string | null) {
  if (postId) return postId;
  const res = await fetch("/api/admin/posts", { method: "POST" });
  const data = (await res.json()) as { id: string };
  return data.id;
}

export function QuickComposer() {
  const router = useRouter();
  const [postId, setPostId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [images, setImages] = useState<FeedComposerImage[]>([]);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const canSubmit = body.trim().length > 0 || images.length > 0;

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setWorking(true);
    setMessage(null);
    try {
      const ensuredId = await ensureDraft(postId);
      setPostId(ensuredId);
      const added: FeedComposerImage[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set("postId", ensuredId);
        fd.set("file", file);
        const res = await fetch("/api/admin/upload", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) continue;
        const image = (await res.json()) as FeedComposerImage;
        added.push(image);
      }
      if (added.length) {
        setImages((prev) => [...prev, ...added]);
      }
    } finally {
      setWorking(false);
    }
  }

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
        setBody("");
        setImages([]);
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
          href="/admin"
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
      uploadFiles={(files) => void uploadFiles(files)}
      working={working}
      message={message}
      onSubmitDraft={() => void submit("DRAFT")}
      onSubmitPublish={() => void submit("PUBLISHED")}
      canSubmit={canSubmit}
    />
  );
}
