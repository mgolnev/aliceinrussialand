"use client";

import { useRef } from "react";
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
  Loader2,
  Plus,
  X,
} from "lucide-react";

export type FeedComposerImage = {
  id: string;
  variants: Record<string, string>;
  width?: number | null;
  height?: number | null;
  caption?: string;
  alt?: string;
};

function SortableThumb({
  image,
  onDelete,
}: {
  image: FeedComposerImage;
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
      className="group relative min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-50 shadow-sm"
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

type Props = {
  className?: string;
  headerLeft: React.ReactNode;
  headerRight?: React.ReactNode;
  body: string;
  onBodyChange: (value: string) => void;
  placeholder?: string;
  images: FeedComposerImage[];
  onImagesChange: (next: FeedComposerImage[]) => void;
  onRemoveImage: (id: string) => void;
  uploadFiles: (files: FileList | null) => void | Promise<void>;
  working: boolean;
  message: string | null;
  publishedUrl?: string | null;
  onSubmitDraft: () => void;
  onSubmitPublish: () => void;
  canSubmit: boolean;
  draftLabel?: string;
  publishLabel?: string;
};

export function FeedComposerPanel({
  className = "",
  headerLeft,
  headerRight,
  body,
  onBodyChange,
  placeholder = "Что нового?",
  images,
  onImagesChange,
  onRemoveImage,
  uploadFiles,
  working,
  message,
  publishedUrl,
  onSubmitDraft,
  onSubmitPublish,
  canSubmit,
  draftLabel = "В черновик",
  publishLabel = "Опубликовать",
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = images.findIndex((image) => image.id === active.id);
    const newIndex = images.findIndex((image) => image.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onImagesChange(arrayMove(images, oldIndex, newIndex));
  }

  return (
    <section
      className={`overflow-hidden rounded-[24px] border border-stone-200/80 bg-white shadow-[0_12px_40px_-12px_rgba(60,44,29,0.2)] sm:rounded-[30px] ${className}`}
    >
      <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/50 px-4 py-2.5 sm:px-6">
        <div className="text-xs font-semibold uppercase tracking-wider text-stone-400">
          {headerLeft}
        </div>
        {headerRight ? (
          <div className="flex shrink-0 items-center gap-2">{headerRight}</div>
        ) : null}
      </div>

      <div className="min-w-0 p-4 sm:p-6">
        <textarea
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-[120px] w-full min-w-0 resize-none border-none bg-transparent p-0 text-[16px] leading-relaxed text-stone-900 outline-none placeholder:text-stone-400 sm:min-h-[160px]"
        />

        {images.length ? (
          <div className="mt-4 min-w-0 space-y-4">
            <div className="min-w-0 rounded-2xl border border-stone-100 bg-stone-50/30 p-2">
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
                        onDelete={() => onRemoveImage(image.id)}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex aspect-square min-w-0 items-center justify-center rounded-xl border-2 border-dashed border-stone-200 text-stone-400 transition-colors hover:border-stone-300 hover:text-stone-500 active:scale-95"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            <div className="min-w-0 opacity-60 grayscale-[0.5]">
              <MediaGrid
                images={images.map((image) => ({
                  id: image.id,
                  src:
                    image.variants.w640 ??
                    image.variants.w960 ??
                    image.variants.w1280,
                  alt: image.alt ?? "",
                }))}
              />
            </div>
          </div>
        ) : null}

        {message ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-50 px-4 py-2.5 text-sm text-stone-600">
            <span>{message}</span>
            {publishedUrl ? (
              <a
                className="font-medium text-stone-900 underline underline-offset-2"
                href={publishedUrl}
              >
                Открыть
              </a>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-stone-50 pt-4">
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={working}
              onClick={() => fileInputRef.current?.click()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 active:scale-90 disabled:opacity-50"
            >
              {working ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <ImageIcon size={20} />
              )}
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

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onSubmitDraft()}
              disabled={!canSubmit || working}
              className="rounded-full px-4 py-2 text-sm font-medium text-stone-500 transition-colors hover:bg-stone-100 active:scale-95 disabled:opacity-50"
            >
              {draftLabel}
            </button>
            <button
              type="button"
              onClick={() => onSubmitPublish()}
              disabled={!canSubmit || working}
              className="flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-stone-800 active:scale-95 disabled:opacity-50"
            >
              {working ? "..." : publishLabel}
              <Send size={16} className="-rotate-12" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
