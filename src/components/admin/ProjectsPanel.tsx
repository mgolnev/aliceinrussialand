"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type ProjectListRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  updatedAt: Date;
  _count: { posts: number };
};

function statusLabel(status: string) {
  if (status === "PUBLISHED") return "Опубликован";
  if (status === "ARCHIVED") return "В архиве";
  return "Черновик";
}

export function ProjectsPanel({ initial }: { initial: ProjectListRow[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createProject() {
    const safeTitle = title.trim();
    if (!safeTitle) {
      setError("Укажите название подборки");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: safeTitle }),
      });
      const data = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
      if (!res.ok || !data?.id) {
        setError(data?.error ?? "Не удалось создать подборку");
        return;
      }
      router.push(`/admin/projects/${data.id}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <form
        className="rounded-[28px] border border-stone-200/80 bg-white/90 p-4 sm:p-5"
        onSubmit={(event) => {
          event.preventDefault();
          void createProject();
        }}
      >
        <label className="block text-sm font-medium text-stone-800">
          Новая подборка
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например, Волк-дурак"
              className="min-w-0 flex-1 rounded-xl border border-stone-300 px-3 py-2.5 text-sm outline-none focus:border-stone-500"
            />
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              Создать
            </button>
          </div>
        </label>
        {error ? <p className="mt-2 text-sm text-red-700" role="alert">{error}</p> : null}
      </form>

      {initial.length ? (
        <ul className="overflow-hidden rounded-[28px] border border-stone-200/80 bg-white/90">
          {initial.map((project) => (
            <li key={project.id} className="border-b border-stone-100 last:border-b-0">
              <Link
                href={`/admin/projects/${project.id}`}
                className="block px-4 py-4 transition hover:bg-stone-50 sm:px-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-stone-900">{project.title}</p>
                    <p className="mt-1 truncate font-mono text-xs text-stone-400">{project.slug}</p>
                  </div>
                  <span className="shrink-0 text-xs text-stone-500">{statusLabel(project.status)}</span>
                </div>
                <p className="mt-2 text-sm text-stone-600">
                  {project._count.posts} публикаций в подборке
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed border-stone-300 px-4 py-8 text-sm leading-6 text-stone-500">
          Пока нет подборок. Создайте первую, затем добавьте связанные публикации.
        </p>
      )}
    </div>
  );
}
