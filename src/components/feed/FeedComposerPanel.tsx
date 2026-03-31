"use client";

import { useEffect, useRef, useState } from "react";
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
  handleMobileEditableBlur,
  handleMobileEditableFocus,
} from "@/lib/mobile-editable-scroll";
import { pillTabClass } from "@/lib/pill-tab-styles";
import {
  Image as ImageIcon,
  Send,
  Loader2,
  Plus,
  X,
  AlertCircle,
  ImagePlus,
} from "lucide-react";
import type { UploadQueueRow } from "@/hooks/use-feed-image-upload-queue";

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
  /** В карточке поста: без второй рамки и без шапки «Редактирование» */
  variant?: "default" | "embedded";
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
  /** Пилюли выбора категории (лента / правка в карточке) */
  categories?: Array<{ id: string; name: string; slug: string }>;
  postCategoryId?: string | null;
  onPostCategoryChange?: (categoryId: string | null) => void;
  /** Очередь загрузки фото: прогресс, остановка, повтор по файлу */
  uploadQueue?: {
    rows: UploadQueueRow[];
    doneCount: number;
    totalPlanned: number;
    isProcessing: boolean;
    onStop: () => void;
    onRetry: (clientId: string) => void;
    onDismissCancelled?: () => void;
  };
  /** Блокировать публикацию/черновик, пока идёт или ожидает очередь загрузки */
  uploadBlocksSubmit?: boolean;
  /** Лента: «+» с меню «фото / Telegram» вместо сразу галереи */
  quickAddMenu?: boolean;
  onRequestTelegramImport?: () => void;
  /** Подсказка после импорта из Telegram */
  importSourceHint?: string | null;
};

export function FeedComposerPanel({
  className = "",
  variant = "default",
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
  categories,
  postCategoryId,
  onPostCategoryChange,
  uploadQueue,
  uploadBlocksSubmit = false,
  quickAddMenu = false,
  onRequestTelegramImport,
  importSourceHint = null,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);

  useEffect(() => {
    if (!message || !messageRef.current) return;
    messageRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [message]);
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

  const isEmbedded = variant === "embedded";

  const shellClass = isEmbedded
    ? `min-w-0 ${className}`
    : `overflow-hidden rounded-[24px] border border-stone-200/80 bg-white shadow-[0_12px_40px_-12px_rgba(60,44,29,0.2)] sm:rounded-[30px] ${className}`;

  const innerClass = isEmbedded
    ? "min-w-0"
    : "min-w-0 px-3 pb-2 pt-4 sm:px-5 sm:pb-2.5 sm:pt-5";

  const Shell = isEmbedded ? "div" : "section";

  const uploadPhotoBusy = Boolean(
    uploadQueue &&
      (uploadQueue.isProcessing ||
        uploadQueue.rows.some(
          (r) => r.status === "pending" || r.status === "uploading",
        )),
  );

  return (
    <Shell className={shellClass}>
      {!isEmbedded ? (
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-stone-100 bg-stone-50/50 px-3 sm:px-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-stone-400">
            {headerLeft}
          </div>
          {headerRight ? (
            <div className="flex shrink-0 items-center gap-2">{headerRight}</div>
          ) : null}
        </div>
      ) : null}

      <div className={innerClass}>
        <textarea
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          onFocus={handleMobileEditableFocus}
          onBlur={handleMobileEditableBlur}
          placeholder={placeholder}
          autoComplete="off"
          autoCorrect="off"
          spellCheck
          className="min-h-[120px] w-full min-w-0 resize-none border-none bg-transparent p-0 text-base leading-relaxed text-stone-900 outline-none placeholder:text-stone-400 sm:min-h-[160px]"
          style={{ fontSize: "max(16px, 1rem)" }}
        />

        {categories &&
        categories.length > 0 &&
        onPostCategoryChange &&
        postCategoryId !== undefined ? (
          <div className="mt-3 min-w-0">
            <p className="mb-1.5 text-xs font-medium text-stone-500">
              Категория
            </p>
            <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] sm:gap-1.5 [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                className={pillTabClass(!postCategoryId)}
                onClick={() => onPostCategoryChange(null)}
              >
                Без категории
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={pillTabClass(postCategoryId === c.id)}
                  onClick={() => onPostCategoryChange(c.id)}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {uploadQueue &&
        (uploadQueue.rows.length > 0 ||
          uploadQueue.isProcessing ||
          uploadQueue.doneCount > 0) ? (
          <div
            className="mt-3 rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-2.5 sm:px-3.5"
            role="region"
            aria-label="Фотографии"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 gap-y-1">
              <p className="text-[13px] font-medium text-stone-700 sm:text-sm">
                Загружено {uploadQueue.doneCount} из {uploadQueue.totalPlanned}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {(uploadQueue.isProcessing ||
                  uploadQueue.rows.some(
                    (r) =>
                      r.status === "pending" || r.status === "uploading",
                  )) ? (
                  <button
                    type="button"
                    onClick={() => uploadQueue.onStop()}
                    className="rounded-full border border-stone-300 bg-white px-3 py-1 text-[13px] font-medium text-stone-700 hover:bg-stone-100 active:scale-[0.98]"
                  >
                    Остановить
                  </button>
                ) : null}
                {uploadQueue.rows.some((r) => r.status === "cancelled") &&
                uploadQueue.onDismissCancelled ? (
                  <button
                    type="button"
                    onClick={() => uploadQueue.onDismissCancelled?.()}
                    className="text-[13px] text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline"
                  >
                    Убрать отменённые
                  </button>
                ) : null}
              </div>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200/90"
              role="progressbar"
              aria-valuenow={uploadQueue.doneCount}
              aria-valuemin={0}
              aria-valuemax={Math.max(1, uploadQueue.totalPlanned)}
            >
              <div
                className="h-full rounded-full bg-emerald-600 transition-[width] duration-300 ease-out"
                style={{
                  width: `${uploadQueue.totalPlanned > 0 ? Math.min(100, Math.round((uploadQueue.doneCount / uploadQueue.totalPlanned) * 100)) : 0}%`,
                }}
              />
            </div>
            {uploadQueue.rows.length > 0 ? (
              <ul className="mt-2.5 max-h-[min(40vh,220px)] space-y-1.5 overflow-y-auto overscroll-contain pr-0.5">
                {uploadQueue.rows.map((row) => (
                  <li
                    key={row.clientId}
                    className="flex items-center gap-2 rounded-lg bg-white/90 px-2 py-1.5 ring-1 ring-stone-100"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={row.previewUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-md object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-stone-800">
                        {row.label}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-stone-500">
                        {row.status === "pending" ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                            <span>В очереди</span>
                          </>
                        ) : null}
                        {row.status === "uploading" ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-emerald-600" />
                            <span className="text-emerald-800">В обработке</span>
                          </>
                        ) : null}
                        {row.status === "error" ? (
                          <>
                            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                            <span className="text-red-700">
                              {row.errorMessage ?? "Ошибка загрузки"}
                            </span>
                          </>
                        ) : null}
                        {row.status === "cancelled" ? (
                          <span className="text-stone-400">Отменено</span>
                        ) : null}
                      </div>
                    </div>
                    {row.status === "error" ? (
                      <button
                        type="button"
                        onClick={() => uploadQueue.onRetry(row.clientId)}
                        className="shrink-0 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[12px] font-medium text-stone-800 hover:bg-stone-100 active:scale-95"
                      >
                        Повторить
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {importSourceHint ? (
          <p
            className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-stone-700"
            role="status"
          >
            <span className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-900">
              Telegram
            </span>
            <span className="text-stone-600">{importSourceHint}</span>
          </p>
        ) : null}

        <div className="mt-3 flex w-full min-w-0 flex-nowrap items-center justify-between gap-2 border-t border-stone-100 pt-3 sm:mt-4 sm:pt-3.5">
          {quickAddMenu ? (
            <>
              <button
                type="button"
                disabled={working || uploadBlocksSubmit}
                onClick={() => setQuickMenuOpen(true)}
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-stone-900 text-white shadow-sm transition-colors hover:bg-stone-800 active:scale-90 disabled:opacity-50"
                aria-label="Добавить контент"
                aria-haspopup="dialog"
                aria-expanded={quickMenuOpen}
              >
                <Plus size={22} strokeWidth={2.5} aria-hidden />
              </button>
              {quickMenuOpen ? (
                <div
                  className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/40 sm:items-center sm:justify-center sm:p-4"
                  role="presentation"
                  onClick={() => setQuickMenuOpen(false)}
                >
                  <div
                    role="menu"
                    className="w-full rounded-t-2xl border border-stone-200/80 bg-white px-4 pt-4 pb-[max(1.75rem,calc(env(safe-area-inset-bottom,0px)+1.25rem))] shadow-xl sm:max-w-sm sm:rounded-2xl sm:p-3 sm:pb-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="pb-3 text-xs font-semibold uppercase tracking-wide text-stone-400 sm:px-0 sm:pb-2">
                      Добавить
                    </p>
                    <div className="flex flex-col gap-3 sm:gap-1">
                      <button
                        type="button"
                        role="menuitem"
                        disabled={uploadPhotoBusy}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-4 text-left text-sm font-medium text-stone-800 hover:bg-stone-50 active:bg-stone-100 disabled:opacity-50 sm:py-3"
                        onClick={() => {
                          setQuickMenuOpen(false);
                          fileInputRef.current?.click();
                        }}
                      >
                        {uploadPhotoBusy ? (
                          <Loader2
                            className="h-5 w-5 shrink-0 animate-spin text-emerald-600"
                            aria-hidden
                          />
                        ) : (
                          <ImagePlus className="h-5 w-5 shrink-0 text-stone-500" />
                        )}
                        Добавить фото
                      </button>
                      {onRequestTelegramImport ? (
                        <button
                          type="button"
                          role="menuitem"
                          disabled={uploadBlocksSubmit}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-4 text-left text-sm font-medium text-stone-800 hover:bg-stone-50 active:bg-stone-100 disabled:opacity-50 sm:py-3"
                          onClick={() => {
                            setQuickMenuOpen(false);
                            onRequestTelegramImport();
                          }}
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-sky-100 text-[11px] font-bold text-sky-800">
                            TG
                          </span>
                          Импорт из Telegram
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <button
              type="button"
              disabled={working}
              onClick={() => fileInputRef.current?.click()}
              className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 active:scale-90 disabled:opacity-50"
              aria-label={uploadPhotoBusy ? "Идёт загрузка фото" : "Добавить фото"}
              aria-busy={uploadPhotoBusy}
            >
              {uploadPhotoBusy ? (
                <Loader2
                  size={20}
                  className="animate-spin text-emerald-600"
                  aria-hidden
                />
              ) : (
                <ImageIcon size={20} aria-hidden />
              )}
            </button>
          )}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <div className="flex min-w-0 flex-1 flex-nowrap items-center justify-end gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => onSubmitDraft()}
              disabled={!canSubmit || working || uploadBlocksSubmit}
              className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-2 text-[13px] font-medium text-stone-500 transition-colors hover:bg-stone-100 active:scale-95 disabled:opacity-50 sm:px-4 sm:text-sm"
            >
              {draftLabel}
            </button>
            <button
              type="button"
              onClick={() => onSubmitPublish()}
              disabled={!canSubmit || working || uploadBlocksSubmit}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-stone-900 px-3 py-2 text-[13px] font-bold text-white shadow-sm transition-all hover:bg-stone-800 active:scale-95 disabled:opacity-50 sm:gap-2 sm:px-5 sm:text-sm"
            >
              {working ? "..." : publishLabel}
              <Send size={15} className="-rotate-12 sm:h-4 sm:w-4" />
            </button>
          </div>
        </div>

        {message ? (
          <div
            ref={messageRef}
            role="alert"
            aria-live="assertive"
            className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600 sm:px-4"
          >
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

        {images.length ? (
          <div className="mt-3 min-w-0 space-y-2.5">
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
                      aria-label={
                        uploadPhotoBusy
                          ? "Идёт загрузка фото"
                          : "Добавить ещё фото"
                      }
                      aria-busy={uploadPhotoBusy}
                      className="flex aspect-square min-w-0 items-center justify-center rounded-xl border-2 border-dashed border-stone-200 text-stone-400 transition-colors hover:border-stone-300 hover:text-stone-500 active:scale-95"
                    >
                      {uploadPhotoBusy ? (
                        <Loader2
                          size={20}
                          className="animate-spin text-emerald-600"
                          aria-hidden
                        />
                      ) : (
                        <Plus size={20} aria-hidden />
                      )}
                    </button>
                  </div>
                </SortableContext>
              </DndContext>
            </div>

            <div className="min-w-0 opacity-60 grayscale-[0.5]">
              <MediaGrid
                fullBleed
                images={images.map((image) => ({
                  id: image.id,
                  src:
                    image.variants.w640 ??
                    image.variants.w960 ??
                    image.variants.w1280,
                  alt: image.alt ?? "",
                  width: image.width,
                  height: image.height,
                }))}
              />
            </div>
          </div>
        ) : null}
      </div>
    </Shell>
  );
}
