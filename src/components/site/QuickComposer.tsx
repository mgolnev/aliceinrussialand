"use client";

import { useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MediaGrid } from "@/components/feed/MediaGrid";
import {
  Image as ImageIcon,
  Send,
  Settings,
  X,
  Plus,
  Loader2,
} from "lucide-react";
import { dispatchFeedRefreshMerge } from "@/lib/feed-refresh";

type UploadedImage = {
  id: string;
  sortOrder: number;
  variants: Record<string, string>;
  width?: number | null;
  height?: number | null;
};

type Props = {
  siteUrl: string;
};

function SortableThumb({
  image,
  onDelete,
}: {
  image: UploadedImage;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const src = image.variants.w640 ?? image.variants.w960 ?? image.variants.w1280;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative overflow-hidden rounded-xl border border-stone-200 bg-stone-50 shadow-sm"
    >
      <button
        type="button"
        className="block w-full cursor-grab touch-none"
        {...attributes}
        {...listeners}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="aspect-square w-full object-cover" />
        ) : (
          <div className="aspect-square w-full bg-stone-100" />
        )}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-red-600 shadow-sm transition hover:bg-white active:scale-90"
      >
        <X size={14} />
      </button>
    </div>
  );
}

async function ensureDraft(postId: string | null) {
  if (postId) return postId;
  const res = await fetch("/api/admin/posts", { method: "POST" });
  const data = (await res.json()) as { id: string };
  return data.id;
}

export function QuickComposer({ siteUrl }: Props) {
  const router = useRouter();
  const [postId, setPostId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const canSubmit = body.trim().length > 0 || images.length > 0;
  const previewTitle = useMemo(() => {
    const clean = body.replace(/\s+/g, " ").trim();
    const sentence = clean.match(/.+?[.!?…](?=\s|$)/)?.[0]?.trim();
    return sentence || clean.slice(0, 140) || "Новая публикация";
  }, [body]);

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setWorking(true);
    setMessage(null);
    try {
      const ensuredId = await ensureDraft(postId);
      setPostId(ensuredId);
      const added: UploadedImage[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set("postId", ensuredId);
        fd.set("file", file);
        const res = await fetch("/api/admin/upload", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) continue;
        const image = (await res.json()) as UploadedImage;
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

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = images.findIndex((image) => image.id === active.id);
    const newIndex = images.findIndex((image) => image.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    setImages((prev) => arrayMove(prev, oldIndex, newIndex));
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
        const url = `${siteUrl.replace(/\/$/, "")}/p/${data.slug}`;
        setPublishedUrl(url);
        setBody("");
        setImages([]);
        setPostId(null);
        setMessage("Пост опубликован");
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
    <section className="mb-6 overflow-hidden rounded-[24px] border border-stone-200/80 bg-white shadow-[0_12px_40px_-12px_rgba(60,44,29,0.2)] sm:rounded-[30px]">
      <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-4 py-2.5 sm:px-6">
        <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
          Новая публикация
        </span>
        <a
          href="/admin"
          className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800"
        >
          <Settings size={14} />
          Админка
        </a>
      </div>

      <div className="p-4 sm:p-6">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Что нового?"
          className="min-h-[120px] w-full resize-none border-none bg-transparent p-0 text-[16px] leading-relaxed text-stone-900 outline-none placeholder:text-stone-400 sm:min-h-[160px]"
        />

        {images.length ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-stone-100 bg-stone-50/30 p-2">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
              >
                <SortableContext
                  items={images.map((image) => image.id)}
                  strategy={rectSortingStrategy}
                >
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {images.map((image) => (
                      <SortableThumb
                        key={image.id}
                        image={image}
                        onDelete={() => void removeImage(image.id)}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-stone-200 text-stone-400 transition-colors hover:border-stone-300 hover:text-stone-500 active:scale-95"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </SortableContext>
              </DndContext>
            </div>
            
            <div className="opacity-60 grayscale-[0.5]">
              <MediaGrid
                images={images.map((image) => ({
                  id: image.id,
                  src:
                    image.variants.w640 ??
                    image.variants.w960 ??
                    image.variants.w1280,
                  alt: "",
                }))}
              />
            </div>
          </div>
        ) : null}

        {message ? (
          <div className="mt-4 flex items-center justify-between rounded-xl bg-stone-50 px-4 py-2.5 text-sm text-stone-600">
            <span>{message}</span>
            {publishedUrl ? (
              <a className="font-medium text-stone-900 underline underline-offset-2" href={publishedUrl}>
                Открыть
              </a>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-stone-50 pt-4">
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={working}
              onClick={() => fileInputRef.current?.click()}
              className="flex h-10 w-10 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 active:scale-90 disabled:opacity-50"
            >
              {working ? <Loader2 size={20} className="animate-spin" /> : <ImageIcon size={20} />}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void uploadFiles(e.target.files)}
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void submit("DRAFT")}
              disabled={!canSubmit || working}
              className="rounded-full px-4 py-2 text-sm font-medium text-stone-500 transition-colors hover:bg-stone-100 active:scale-95 disabled:opacity-50"
            >
              В черновик
            </button>
            <button
              type="button"
              onClick={() => void submit("PUBLISHED")}
              disabled={!canSubmit || working}
              className="flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-stone-800 active:scale-95 disabled:opacity-50"
            >
              {working ? "..." : "Опубликовать"}
              <Send size={16} className="-rotate-12" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
