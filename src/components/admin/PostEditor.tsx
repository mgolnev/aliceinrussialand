"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import slugify from "slugify";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { POST_STATUS } from "@/lib/constants";

export type EditorImage = {
  id: string;
  sortOrder: number;
  caption: string;
  alt: string;
  variants: Record<string, string>;
};

export type EditorPost = {
  id: string;
  title: string;
  slug: string;
  body: string;
  displayMode: "GRID" | "STACK";
  status: string;
  pinned: boolean;
  metaTitle: string;
  metaDescription: string;
  telegramSourceUrl: string | null;
  locale: string;
  images: EditorImage[];
};

type Props = {
  initial: EditorPost;
  siteUrl: string;
};

function makeSlug(value: string) {
  const slug = slugify(value.trim(), {
    lower: true,
    strict: true,
    locale: "ru",
  });
  return slug || "post";
}

function normalizeEditorPost(data: EditorPost & { images: EditorImage[] }): EditorPost {
  return {
    id: data.id,
    title: data.title,
    slug: data.slug,
    body: data.body,
    displayMode: data.displayMode,
    status: data.status,
    pinned: data.pinned,
    metaTitle: data.metaTitle,
    metaDescription: data.metaDescription,
    telegramSourceUrl: data.telegramSourceUrl,
    locale: data.locale,
    images: [],
  };
}

function draftSnapshot(post: EditorPost, images: EditorImage[]) {
  return JSON.stringify({
    title: post.title,
    slug: post.slug,
    body: post.body,
    displayMode: post.displayMode,
    pinned: post.pinned,
    metaTitle: post.metaTitle,
    metaDescription: post.metaDescription,
    telegramSourceUrl: post.telegramSourceUrl,
    locale: post.locale,
    images: images.map((im, index) => ({
      id: im.id,
      caption: im.caption,
      alt: im.alt,
      sortOrder: index,
    })),
  });
}

function SortableRow({
  image,
  onCaption,
  onAlt,
  onDelete,
}: {
  image: EditorImage;
  onCaption: (v: string) => void;
  onAlt: (v: string) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const src = image.variants.w640 ?? image.variants.w960 ?? "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex flex-col gap-3 rounded-[24px] border border-stone-200 bg-white p-3 shadow-sm sm:flex-row"
    >
      <button
        type="button"
        className="flex h-24 w-full shrink-0 cursor-grab items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-stone-50 text-stone-400 sm:h-28 sm:w-28"
        {...attributes}
        {...listeners}
        aria-label="Перетащить"
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        ) : (
          "⋮⋮"
        )}
      </button>
      <div className="min-w-0 flex-1 space-y-2">
        <input
          className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-400"
          placeholder="Подпись"
          value={image.caption}
          onChange={(e) => onCaption(e.target.value)}
        />
        <details className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600">
          <summary className="cursor-pointer select-none">SEO и описание фото</summary>
          <div className="mt-2 space-y-2">
            <input
              className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-400"
              placeholder="Alt для SEO"
              value={image.alt}
              onChange={(e) => onAlt(e.target.value)}
            />
            <button
              type="button"
              className="text-sm text-red-600 hover:underline"
              onClick={onDelete}
            >
              Удалить фото
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}

export function PostEditor({ initial, siteUrl }: Props) {
  const [post, setPost] = useState(initial);
  const [images, setImages] = useState(
    [...initial.images].sort((a, b) => a.sortOrder - b.sortOrder),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [slugTouched, setSlugTouched] = useState(
    !initial.slug.startsWith("draft-") && !initial.slug.startsWith("post-"),
  );
  const lastSavedRef = useRef(draftSnapshot(initial, images));
  const autosaveReadyRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const savePost = useCallback(
    async (
      patch: Partial<EditorPost> & { images?: EditorImage[] },
      nextImages?: EditorImage[],
      options?: {
        silent?: boolean;
        successMessage?: string;
      },
    ) => {
      setSaving(true);
      if (!options?.silent) {
        setMessage(null);
      }
      const imgs = nextImages ?? patch.images ?? images;
      const ordered = imgs.map((im, i) => ({
        id: im.id,
        sortOrder: i,
        caption: im.caption,
        alt: im.alt,
      }));
      const res = await fetch(`/api/admin/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...patch,
          title: "",
          images: ordered,
        }),
      });
      setSaving(false);
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        };
        setMessage(data?.error ?? "Не удалось сохранить");
        return false;
      }
      const data = (await res.json()) as EditorPost & { images: EditorImage[] };
      const normalizedPost = normalizeEditorPost(data);
      const normalizedImages = [...data.images].sort(
        (a, b) => a.sortOrder - b.sortOrder,
      );
      setPost(normalizedPost);
      setImages(normalizedImages);
      lastSavedRef.current = draftSnapshot(normalizedPost, normalizedImages);
      setMessage(options?.successMessage ?? "Сохранено");
      return true;
    },
    [post.id, images],
  );

  const currentSnapshot = useMemo(() => draftSnapshot(post, images), [post, images]);

  useEffect(() => {
    if (!autosaveReadyRef.current) {
      autosaveReadyRef.current = true;
      return;
    }

    if (currentSnapshot === lastSavedRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      void savePost(
        {
          title: post.title,
          body: post.body,
          slug: post.slug,
          displayMode: post.displayMode,
          metaTitle: post.metaTitle,
          metaDescription: post.metaDescription,
          telegramSourceUrl: post.telegramSourceUrl,
          pinned: post.pinned,
          locale: post.locale,
        },
        images,
        {
          silent: true,
          successMessage: "Автосохранено",
        },
      );
    }, 900);

    return () => window.clearTimeout(timer);
  }, [currentSnapshot, images, post, savePost]);

  useEffect(() => {
    if (slugTouched) return;
    setPost((prev) => {
      const nextSlug = makeSlug(prev.title || "post");
      if (prev.slug === nextSlug) return prev;
      return {
        ...prev,
        slug: nextSlug,
      };
    });
  }, [post.title, slugTouched]);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = images.findIndex((i) => i.id === active.id);
    const newIndex = images.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(images, oldIndex, newIndex);
    setImages(next);
    void savePost({}, next, { successMessage: "Порядок фото сохранён" });
  };

  const onUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setMessage(null);
    try {
      const added: EditorImage[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.set("postId", post.id);
        fd.set("file", file);
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        if (!res.ok) continue;
        const row = (await res.json()) as Omit<EditorImage, "caption" | "alt">;
        added.push({
          ...row,
          caption: "",
          alt: "",
        });
      }
      if (added.length) {
        setImages((prev) => {
          const next = [...prev, ...added];
          void savePost({}, next, { successMessage: "Фотографии добавлены" });
          return next;
        });
      }
    } finally {
      setUploading(false);
    }
  };

  const publicUrl = useMemo(
    () => `${siteUrl.replace(/\/$/, "")}/p/${post.slug}`,
    [siteUrl, post.slug],
  );
  const isPublished = post.status === POST_STATUS.PUBLISHED;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-[28px] border border-stone-200/80 bg-white/90 p-6 shadow-[0_20px_50px_-40px_rgba(60,44,29,0.35)]">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                isPublished
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {isPublished ? "Опубликовано" : "Черновик"}
            </span>
            {saving ? (
              <span className="text-xs text-stone-500">Сохраняем…</span>
            ) : null}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Редактор поста</h1>
          <p className="max-w-2xl text-sm leading-6 text-stone-600">
            Интерфейс упрощён под сценарий мессенджера: пишете текст, добавляете
            фото, порядок сохраняется при перетаскивании, публикация сразу
            забирает все текущие изменения.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-stone-800"
            onClick={() =>
              void savePost({
                title: post.title,
                body: post.body,
                slug: post.slug,
                displayMode: post.displayMode,
                metaTitle: post.metaTitle,
                metaDescription: post.metaDescription,
                telegramSourceUrl: post.telegramSourceUrl,
                pinned: post.pinned,
                locale: post.locale,
              }, undefined, { successMessage: "Черновик сохранён" })
            }
          >
            Сохранить
          </button>
          <button
            type="button"
            className="rounded-full bg-emerald-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-800"
            onClick={() =>
              void savePost(
                {
                  status: POST_STATUS.PUBLISHED,
                  title: post.title,
                  body: post.body,
                  slug: post.slug,
                  displayMode: post.displayMode,
                  metaTitle: post.metaTitle,
                  metaDescription: post.metaDescription,
                  telegramSourceUrl: post.telegramSourceUrl,
                  pinned: post.pinned,
                  locale: post.locale,
                },
                undefined,
                {
                  successMessage: isPublished
                    ? "Публикация обновлена"
                    : "Пост опубликован",
                },
              ).then((ok) => {
                if (ok) setPost((p) => ({ ...p, status: POST_STATUS.PUBLISHED }));
              })
            }
          >
            {isPublished ? "Обновить публикацию" : "Опубликовать"}
          </button>
          <button
            type="button"
            className="rounded-full border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm"
            onClick={() => void navigator.clipboard.writeText(publicUrl)}
          >
            Копировать ссылку
          </button>
          <button
            type="button"
            className="rounded-full border border-stone-300 bg-white px-3 py-2 text-sm shadow-sm"
            onClick={() => setShowPreview((v) => !v)}
          >
            {showPreview ? "Скрыть предпросмотр" : "Предпросмотр"}
          </button>
          <Link
            href="/admin"
            className="rounded-full px-3 py-2 text-sm text-stone-600 hover:bg-white hover:text-stone-900"
          >
            К списку
          </Link>
        </div>
      </div>

      {message ? (
        <p
          className="rounded-2xl border border-stone-200/80 bg-white/75 px-4 py-3 text-sm text-stone-600"
          role="status"
        >
          {message}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <div className="space-y-5 rounded-[28px] border border-stone-200/80 bg-white/90 p-5 shadow-[0_20px_50px_-40px_rgba(60,44,29,0.35)] sm:p-6">
          <label className="block text-sm font-medium">
            Slug (URL)
            <input
              className="mt-1 w-full rounded-2xl border border-stone-300 px-4 py-3 font-mono text-sm outline-none focus:border-stone-400"
              value={post.slug}
              onChange={(e) => {
                setSlugTouched(true);
                setPost((p) => ({ ...p, slug: e.target.value }));
              }}
            />
            <p className="mt-1 text-xs text-stone-500">
              Если не редактировать вручную, адрес будет обновляться по заголовку.
            </p>
          </label>
          <label className="block text-sm font-medium">
            Текст поста
            <textarea
              className="mt-1 min-h-[260px] w-full rounded-[24px] border border-stone-300 px-4 py-4 leading-7 outline-none focus:border-stone-400"
              value={post.body}
              placeholder="Напишите текст так, как будто публикуете пост в канале…"
              onChange={(e) => setPost((p) => ({ ...p, body: e.target.value }))}
            />
          </label>
          <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-stone-900">Фотографии</h2>
                <p className="text-sm text-stone-500">
                  Добавляйте сразу несколько фото. После загрузки их можно
                  перетаскивать мышью.
                </p>
              </div>
              <label className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-stone-800">
                {uploading ? "Загружаем…" : "Добавить фото"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={uploading}
                  className="hidden"
                  onChange={(e) => void onUpload(e.target.files)}
                />
              </label>
            </div>
            <p className="mt-3 text-sm text-stone-500">
              В ленте фото показываются плиткой, а внутри отдельного поста —
              последовательно друг за другом.
            </p>
          </div>
          {uploading ? (
            <p className="text-sm text-stone-500">Загрузка…</p>
          ) : null}

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Лента фотографий</h2>
              <span className="text-sm text-stone-500">{images.length} шт.</span>
            </div>
            {images.length ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
              >
                <SortableContext
                  items={images.map((i) => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {images.map((im) => (
                      <SortableRow
                        key={im.id}
                        image={im}
                        onCaption={(v) =>
                          setImages((prev) =>
                            prev.map((x) =>
                              x.id === im.id ? { ...x, caption: v } : x,
                            ),
                          )
                        }
                        onAlt={(v) =>
                          setImages((prev) =>
                            prev.map((x) =>
                              x.id === im.id ? { ...x, alt: v } : x,
                            ),
                          )
                        }
                        onDelete={async () => {
                          await fetch(`/api/admin/images/${im.id}`, {
                            method: "DELETE",
                          });
                          const next = images.filter((x) => x.id !== im.id);
                          setImages(next);
                          void savePost({}, next, {
                            successMessage: "Фото удалено",
                          });
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50/60 px-4 py-10 text-center text-sm text-stone-500">
                Пока нет фото. Добавьте изображения выше, и они появятся в
                будущей публикации.
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          <div className="rounded-[28px] border border-stone-200/80 bg-white/90 p-5 shadow-[0_20px_50px_-40px_rgba(60,44,29,0.35)]">
            <h2 className="text-lg font-semibold">Быстрые действия</h2>
            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-2 rounded-2xl bg-stone-50 px-3 py-3 text-sm">
                <input
                  type="checkbox"
                  checked={post.pinned}
                  onChange={(e) =>
                    setPost((p) => ({ ...p, pinned: e.target.checked }))
                  }
                />
                Закрепить вверху ленты
              </label>
              <button
                type="button"
                className="w-full rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 shadow-sm"
                onClick={() =>
                  void savePost(
                    {
                      status: POST_STATUS.DRAFT,
                      title: post.title,
                      body: post.body,
                      slug: post.slug,
                      displayMode: post.displayMode,
                      metaTitle: post.metaTitle,
                      metaDescription: post.metaDescription,
                      telegramSourceUrl: post.telegramSourceUrl,
                      pinned: post.pinned,
                      locale: post.locale,
                    },
                    undefined,
                    { successMessage: "Пост сохранён как черновик" },
                  ).then((ok) => {
                    if (ok) {
                      setPost((p) => ({ ...p, status: POST_STATUS.DRAFT }));
                    }
                  })
                }
              >
                Снять с публикации
              </button>
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 shadow-sm"
              >
                Открыть на сайте
              </a>
            </div>
          </div>

          <details className="rounded-[28px] border border-stone-200/80 bg-white/90 p-5 shadow-[0_20px_50px_-40px_rgba(60,44,29,0.35)]">
            <summary className="cursor-pointer list-none text-lg font-semibold">
              Расширенные настройки
            </summary>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-medium">
                Meta title
                <input
                  className="mt-1 w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm outline-none focus:border-stone-400"
                  value={post.metaTitle}
                  onChange={(e) =>
                    setPost((p) => ({ ...p, metaTitle: e.target.value }))
                  }
                  placeholder="Если оставить пустым, возьмётся заголовок"
                />
              </label>
              <label className="block text-sm font-medium">
                Meta description
                <textarea
                  className="mt-1 min-h-[96px] w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm outline-none focus:border-stone-400"
                  value={post.metaDescription}
                  onChange={(e) =>
                    setPost((p) => ({ ...p, metaDescription: e.target.value }))
                  }
                  placeholder="Если оставить пустым, возьмётся начало текста"
                />
              </label>
              <label className="block text-sm font-medium">
                Ссылка на оригинал в Telegram
                <input
                  className="mt-1 w-full rounded-2xl border border-stone-300 px-4 py-3 text-sm outline-none focus:border-stone-400"
                  value={post.telegramSourceUrl ?? ""}
                  onChange={(e) =>
                    setPost((p) => ({
                      ...p,
                      telegramSourceUrl: e.target.value || null,
                    }))
                  }
                />
              </label>
            </div>
          </details>

          <div className="rounded-[28px] border border-stone-200/80 bg-white/90 p-5 shadow-[0_20px_50px_-40px_rgba(60,44,29,0.35)]">
            <button
              type="button"
              className="w-full rounded-full border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700"
              onClick={() => {
                if (!window.confirm("Удалить пост целиком вместе с фотографиями?")) {
                  return;
                }
                void fetch(`/api/admin/posts/${post.id}`, {
                  method: "DELETE",
                }).then((res) => {
                  if (res.ok) {
                    window.location.href = "/admin";
                  } else {
                    setMessage("Не удалось удалить пост");
                  }
                });
              }}
            >
              Удалить пост
            </button>
          </div>
        </div>
      </div>

      {showPreview ? (
        <div className="rounded-[28px] border border-dashed border-stone-300 bg-white/90 p-6">
          <h3 className="mb-4 text-sm font-medium uppercase tracking-wide text-stone-500">
            Предпросмотр карточки
          </h3>
          <div className="rounded-[28px] border border-stone-200 bg-stone-50/70 p-5">
            <p className="whitespace-pre-wrap text-stone-800">{post.body}</p>
            <div className="mt-4 space-y-3">
              {images.map((im) => {
                const src =
                  im.variants.w640 ?? im.variants.w960 ?? im.variants.w1280;
                return src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={im.id}
                    src={src}
                    alt={im.alt || post.title}
                    className="w-full rounded-2xl"
                  />
                ) : null;
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
