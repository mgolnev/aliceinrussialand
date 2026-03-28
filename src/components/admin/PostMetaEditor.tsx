"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { POST_STATUS } from "@/lib/constants";
import { dispatchFeedRefreshMerge } from "@/lib/feed-refresh";
import {
  handleMobileEditableBlur,
  handleMobileEditableFocus,
} from "@/lib/mobile-editable-scroll";

export type PostMetaInitial = {
  id: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  status: string;
};

type Props = {
  initial: PostMetaInitial;
  siteUrl: string;
};

export function PostMetaEditor({ initial, siteUrl }: Props) {
  const router = useRouter();
  const [post, setPost] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const publicUrl = `${siteUrl.replace(/\/$/, "")}/p/${post.slug}`;
  const published = post.status === POST_STATUS.PUBLISHED;

  const saveMeta = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: post.slug,
          metaTitle: post.metaTitle,
          metaDescription: post.metaDescription,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        slug?: string;
        metaTitle?: string;
        metaDescription?: string;
      };
      if (!res.ok) {
        setMessage(data?.error ?? "Не удалось сохранить");
        return;
      }
      if (data && typeof data.slug === "string") {
        const nextSlug = data.slug;
        const nextMetaTitle =
          typeof data.metaTitle === "string" ? data.metaTitle : post.metaTitle;
        const nextMetaDescription =
          typeof data.metaDescription === "string"
            ? data.metaDescription
            : post.metaDescription;
        setPost((p) => ({
          ...p,
          slug: nextSlug,
          metaTitle: nextMetaTitle,
          metaDescription: nextMetaDescription,
        }));
      }
      setMessage("Сохранено");
      dispatchFeedRefreshMerge();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }, [post.id, post.slug, post.metaTitle, post.metaDescription, router]);

  const setStatus = useCallback(
    async (status: string, successMsg: string) => {
      setSaving(true);
      setMessage(null);
      try {
        const res = await fetch(`/api/admin/posts/${post.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const data = (await res.json().catch(() => null)) as { error?: string };
        if (!res.ok) {
          setMessage(data?.error ?? "Не удалось изменить статус");
          return;
        }
        setPost((p) => ({ ...p, status }));
        setMessage(successMsg);
        if (status === POST_STATUS.PUBLISHED) {
          dispatchFeedRefreshMerge();
        }
        router.refresh();
      } finally {
        setSaving(false);
      }
    },
    [post.id, router],
  );

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div className="rounded-2xl border border-stone-200/80 bg-white/90 px-4 py-4 shadow-sm sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              published
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {published ? "Опубликовано" : "Черновик"}
          </span>
          {saving ? (
            <span className="text-xs text-stone-500">Сохраняем…</span>
          ) : null}
        </div>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">
          Slug и SEO
        </h1>
        <p className="mt-1 text-[14px] leading-snug text-stone-600">
          Текст и фото правьте в ленте на сайте. Здесь — только адрес страницы и
          сниппет для поиска и соцсетей.
        </p>
      </div>

      {message ? (
        <p
          className="rounded-xl border border-stone-200/80 bg-white/75 px-3 py-2.5 text-[14px] text-stone-600"
          role="status"
        >
          {message}
        </p>
      ) : null}

      <div className="space-y-4 rounded-2xl border border-stone-200/80 bg-white/90 px-4 py-4 shadow-sm sm:px-5 sm:py-5">
        <label className="block text-[14px] font-medium text-stone-800">
          Slug (путь URL)
          <input
            className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 font-mono text-[14px] outline-none focus:border-stone-400"
            value={post.slug}
            onChange={(e) =>
              setPost((p) => ({ ...p, slug: e.target.value }))
            }
            onFocus={handleMobileEditableFocus}
            onBlur={handleMobileEditableBlur}
            autoComplete="off"
          />
        </label>

        <label className="block text-[14px] font-medium text-stone-800">
          SEO title
          <input
            className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-[14px] outline-none focus:border-stone-400"
            value={post.metaTitle}
            onChange={(e) =>
              setPost((p) => ({ ...p, metaTitle: e.target.value }))
            }
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
            value={post.metaDescription}
            onChange={(e) =>
              setPost((p) => ({ ...p, metaDescription: e.target.value }))
            }
            placeholder="Пусто — возьмётся начало текста"
            onFocus={handleMobileEditableFocus}
            onBlur={handleMobileEditableBlur}
          />
        </label>

        <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={saving}
            className="rounded-full bg-stone-900 px-4 py-2.5 text-[14px] font-medium text-white shadow-sm hover:bg-stone-800 disabled:opacity-50"
            onClick={() => void saveMeta()}
          >
            Сохранить
          </button>
          {published ? (
            <button
              type="button"
              disabled={saving}
              className="rounded-full border border-stone-300 bg-white px-4 py-2.5 text-[14px] font-medium text-stone-800 shadow-sm hover:bg-stone-50 disabled:opacity-50"
              onClick={() =>
                void setStatus(POST_STATUS.DRAFT, "Снято с публикации")
              }
            >
              В черновик
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              className="rounded-full bg-emerald-700 px-4 py-2.5 text-[14px] font-medium text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
              onClick={() => void setStatus(POST_STATUS.PUBLISHED, "Опубликовано")}
            >
              Опубликовать
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl border border-stone-200/80 bg-white/90 px-4 py-4 shadow-sm sm:flex-row sm:flex-wrap sm:px-5">
        <Link
          href="/admin/posts"
          className="inline-flex items-center justify-center rounded-full border border-stone-200 bg-white px-4 py-2.5 text-center text-[14px] text-stone-700 hover:bg-stone-50"
        >
          К списку постов
        </Link>
        {published ? (
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-stone-200 bg-white px-4 py-2.5 text-center text-[14px] text-stone-700 hover:bg-stone-50"
          >
            Открыть на сайте
          </a>
        ) : null}
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full border border-stone-200 bg-white px-4 py-2.5 text-[14px] text-stone-700 hover:bg-stone-50"
          onClick={() => void navigator.clipboard.writeText(publicUrl)}
        >
          Копировать ссылку
        </button>
      </div>

      <div className="rounded-2xl border border-red-200/80 bg-red-50/40 px-4 py-4">
        <button
          type="button"
          className="w-full rounded-full border border-red-200 bg-white px-4 py-2.5 text-[14px] font-medium text-red-700 hover:bg-red-50"
          onClick={() => {
            if (!window.confirm("Удалить пост целиком вместе с фотографиями?")) {
              return;
            }
            void fetch(`/api/admin/posts/${post.id}`, { method: "DELETE" }).then(
              (res) => {
                if (res.ok) {
                  dispatchFeedRefreshMerge();
                  window.location.href = "/admin/posts";
                } else {
                  setMessage("Не удалось удалить пост");
                }
              },
            );
          }}
        >
          Удалить пост
        </button>
      </div>
    </div>
  );
}
