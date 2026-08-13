"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type PostOption = {
  id: string;
  title: string;
  slug: string;
  status: string;
  publishedAt: string | null;
};

type InitialProject = {
  id: string;
  slug: string;
  title: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
  status: string;
  postIds: string[];
};

type Props = { initial: InitialProject; posts: PostOption[] };

function postLabel(post: PostOption) {
  return post.title.trim() || post.slug;
}

export function ProjectEditor({ initial, posts }: Props) {
  const router = useRouter();
  const [project, setProject] = useState(initial);
  const [postIds, setPostIds] = useState(initial.postIds);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const postById = useMemo(() => new Map(posts.map((post) => [post.id, post])), [posts]);
  const selected = postIds.map((id) => postById.get(id)).filter((post): post is PostOption => Boolean(post));
  const available = posts
    .filter((post) => !postIds.includes(post.id))
    .filter((post) => {
      const q = query.trim().toLocaleLowerCase("ru-RU");
      return !q || `${post.title} ${post.slug}`.toLocaleLowerCase("ru-RU").includes(q);
    })
    .slice(0, 12);

  function move(id: string, delta: number) {
    setPostIds((current) => {
      const from = current.indexOf(id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      [next[from], next[to]] = [next[to]!, next[from]!];
      return next;
    });
  }

  async function save(status = project.status) {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...project, status, postIds }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; slug?: string; status?: string }
        | null;
      if (!res.ok) {
        setMessage(data?.error ?? "Не удалось сохранить цикл");
        return;
      }
      setProject((current) => ({
        ...current,
        slug: typeof data?.slug === "string" ? data.slug : current.slug,
        status: typeof data?.status === "string" ? data.status : status,
      }));
      setMessage(status === "PUBLISHED" ? "Цикл опубликован" : "Сохранено");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject() {
    if (!window.confirm("Удалить цикл? Публикации сайта останутся на месте.")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/projects/${project.id}`, { method: "DELETE" });
      if (!res.ok) {
        setMessage("Не удалось удалить цикл");
        return;
      }
      router.push("/admin/projects");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-stone-500">Авторский цикл</p>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{project.title || "Новый цикл"}</h1>
        </div>
        <Link href="/admin/projects" className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 hover:bg-stone-50">
          К циклам
        </Link>
      </div>

      {message ? <p className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-700" role="status">{message}</p> : null}

      <section className="space-y-4 rounded-[28px] border border-stone-200/80 bg-white/90 p-4 sm:p-5">
        <label className="block text-sm font-medium text-stone-800">Название
          <input value={project.title} onChange={(event) => setProject((current) => ({ ...current, title: event.target.value }))} className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-stone-500" />
        </label>
        <label className="block text-sm font-medium text-stone-800">Slug (URL)
          <input value={project.slug} onChange={(event) => setProject((current) => ({ ...current, slug: event.target.value }))} className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-stone-500" />
        </label>
        <label className="block text-sm font-medium text-stone-800">Описание цикла
          <textarea value={project.description} onChange={(event) => setProject((current) => ({ ...current, description: event.target.value }))} rows={4} placeholder="Что объединяет эти публикации?" className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm leading-6 outline-none focus:border-stone-500" />
        </label>
        <details className="rounded-xl bg-stone-50 px-3 py-2.5">
          <summary className="cursor-pointer text-sm font-medium text-stone-700">SEO-настройки</summary>
          <div className="mt-3 space-y-3">
            <label className="block text-sm text-stone-700">SEO title<input value={project.metaTitle} onChange={(event) => setProject((current) => ({ ...current, metaTitle: event.target.value }))} className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none" /></label>
            <label className="block text-sm text-stone-700">SEO description<textarea value={project.metaDescription} onChange={(event) => setProject((current) => ({ ...current, metaDescription: event.target.value }))} rows={3} className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm outline-none" /></label>
          </div>
        </details>
      </section>

      <section className="rounded-[28px] border border-stone-200/80 bg-white/90 p-4 sm:p-5">
        <h2 className="text-lg font-semibold tracking-tight text-stone-900">Публикации цикла</h2>
        <p className="mt-1 text-sm leading-6 text-stone-600">Их порядок станет порядком чтения на странице цикла и в блоке под постом.</p>
        <ol className="mt-4 space-y-2">
          {selected.map((post, index) => (
            <li key={post.id} className="flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2.5">
              <span className="w-5 shrink-0 text-right text-sm tabular-nums text-stone-400">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-stone-800">{postLabel(post)}</span>
              <span className="hidden text-xs text-stone-400 sm:inline">{post.status === "PUBLISHED" ? "опубликовано" : "черновик"}</span>
              <button type="button" onClick={() => move(post.id, -1)} disabled={index === 0 || saving} className="rounded-lg px-2 py-1 text-sm text-stone-600 hover:bg-stone-100 disabled:opacity-30" aria-label="Переместить выше">↑</button>
              <button type="button" onClick={() => move(post.id, 1)} disabled={index === selected.length - 1 || saving} className="rounded-lg px-2 py-1 text-sm text-stone-600 hover:bg-stone-100 disabled:opacity-30" aria-label="Переместить ниже">↓</button>
              <button type="button" onClick={() => setPostIds((current) => current.filter((id) => id !== post.id))} disabled={saving} className="rounded-lg px-2 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-30">Убрать</button>
            </li>
          ))}
        </ol>
        {!selected.length ? <p className="mt-4 text-sm text-stone-500">Добавьте минимум две публикации, чтобы цикл можно было опубликовать.</p> : null}
        <div className="mt-5 border-t border-stone-100 pt-4">
          <label className="block text-sm font-medium text-stone-800">Добавить публикацию
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти по названию или slug" className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-stone-500" />
          </label>
          {available.length ? <ul className="mt-2 divide-y divide-stone-100 rounded-xl border border-stone-200">{available.map((post) => <li key={post.id} className="flex items-center gap-3 px-3 py-2"><span className="min-w-0 flex-1 truncate text-sm text-stone-700">{postLabel(post)}</span><button type="button" onClick={() => setPostIds((current) => [...current, post.id])} className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50">Добавить</button></li>)}</ul> : null}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={saving} onClick={() => void save()} className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50">Сохранить</button>
        {project.status === "PUBLISHED" ? <button type="button" disabled={saving} onClick={() => void save("DRAFT")} className="rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50">В черновик</button> : <button type="button" disabled={saving} onClick={() => void save("PUBLISHED")} className="rounded-full bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50">Опубликовать</button>}
        <button type="button" disabled={saving} onClick={() => void deleteProject()} className="rounded-full border border-red-200 bg-white px-5 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">Удалить</button>
      </div>
    </div>
  );
}
