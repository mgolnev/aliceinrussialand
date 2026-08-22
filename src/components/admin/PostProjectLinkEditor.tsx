"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { adminCredentials, readAdminResponseJson } from "@/lib/admin-fetch";
import { pillTabClass } from "@/lib/pill-tab-styles";

type ProjectOption = { id: string; title: string };
type PostOption = { id: string; title: string; slug: string };
type ProjectPosts = { projectId: string; postIds: string[] };

type Props = {
  post: PostOption;
  projects: ProjectOption[];
  selectedIds: string[];
  onChange: (projectIds: string[]) => void;
  onCancel: () => void;
  onSave: (projectIds: string[], projectPosts?: ProjectPosts) => void;
  saving?: boolean;
  message?: string | null;
};

function postLabel(post: PostOption) {
  return post.title.trim() || post.slug;
}

/** Компактная форма: выбор/создание подборки и состав её публикаций. */
export function PostProjectLinkEditor({
  post,
  projects,
  selectedIds,
  onChange,
  onCancel,
  onSave,
  saving = false,
  message = null,
}: Props) {
  const [projectQuery, setProjectQuery] = useState("");
  const [createdProjects, setCreatedProjects] = useState<ProjectOption[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(
    selectedIds[0] ?? null,
  );
  const [projectPosts, setProjectPosts] = useState<PostOption[]>([]);
  const [loadingProjectPosts, setLoadingProjectPosts] = useState(false);
  const [postQuery, setPostQuery] = useState("");
  const [postResults, setPostResults] = useState<PostOption[]>([]);

  const normalizedProjectQuery = projectQuery.trim();
  const allProjects = useMemo(() => {
    const seen = new Set<string>();
    return [...createdProjects, ...projects].filter((project) => {
      if (seen.has(project.id)) return false;
      seen.add(project.id);
      return true;
    });
  }, [createdProjects, projects]);
  const matchingProjects = allProjects.filter((project) =>
    project.title.toLocaleLowerCase("ru-RU").includes(
      normalizedProjectQuery.toLocaleLowerCase("ru-RU"),
    ),
  );
  const hasExactTitle = allProjects.some(
    (project) =>
      project.title.trim().toLocaleLowerCase("ru-RU") ===
      normalizedProjectQuery.toLocaleLowerCase("ru-RU"),
  );

  useEffect(() => {
    if (!activeProjectId || !selectedIds.includes(activeProjectId)) {
      setActiveProjectId(selectedIds[0] ?? null);
    }
  }, [activeProjectId, selectedIds]);

  useEffect(() => {
    if (!activeProjectId) {
      setProjectPosts([]);
      return;
    }
    let cancelled = false;
    setLoadingProjectPosts(true);
    void (async () => {
      try {
        const res = await fetch(`/api/admin/projects/${activeProjectId}`, {
          ...adminCredentials,
        });
        const data = await readAdminResponseJson(res);
        if (!res.ok || !data || typeof data !== "object" || cancelled) return;
        const relations = Array.isArray((data as { posts?: unknown }).posts)
          ? ((data as { posts: unknown[] }).posts ?? [])
          : [];
        const loaded = relations.flatMap((relation) => {
          if (!relation || typeof relation !== "object") return [];
          const nested = (relation as { post?: unknown }).post;
          if (!nested || typeof nested !== "object") return [];
          const { id, title, slug } = nested as {
            id?: unknown;
            title?: unknown;
            slug?: unknown;
          };
          return typeof id === "string" && typeof title === "string" && typeof slug === "string"
            ? [{ id, title, slug }]
            : [];
        });
        if (!cancelled) {
          // Не переставляем уже собранный цикл при добавлении поста из быстрой формы.
          // В ручном порядке новый пост должен оказаться последним.
          setProjectPosts(
            loaded.some((item) => item.id === post.id) ? loaded : [...loaded, post],
          );
        }
      } finally {
        if (!cancelled) setLoadingProjectPosts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId, post]);

  useEffect(() => {
    const query = postQuery.trim();
    if (!activeProjectId || query.length < 2) {
      setPostResults([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await fetch(
            `/api/admin/posts?q=${encodeURIComponent(query)}`,
            { ...adminCredentials },
          );
          const data = await readAdminResponseJson(res);
          if (!res.ok || !data || typeof data !== "object" || cancelled) return;
          const items = Array.isArray((data as { items?: unknown }).items)
            ? ((data as { items: unknown[] }).items ?? [])
            : [];
          setPostResults(
            items.flatMap((item) => {
              if (!item || typeof item !== "object") return [];
              const { id, title, slug } = item as {
                id?: unknown;
                title?: unknown;
                slug?: unknown;
              };
              return typeof id === "string" && typeof title === "string" && typeof slug === "string"
                ? [{ id, title, slug }]
                : [];
            }),
          );
        } catch {
          if (!cancelled) setPostResults([]);
        }
      })();
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeProjectId, postQuery]);

  async function createProject() {
    if (!normalizedProjectQuery || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: normalizedProjectQuery }),
        ...adminCredentials,
      });
      const data = await readAdminResponseJson(res);
      if (!res.ok || !data || typeof data !== "object") {
        const error =
          data &&
          typeof data === "object" &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Не удалось создать подборку";
        setCreateError(error);
        return;
      }
      const id = (data as { id?: unknown }).id;
      if (typeof id !== "string") {
        setCreateError("Не удалось создать подборку");
        return;
      }
      const project = { id, title: normalizedProjectQuery };
      setCreatedProjects((current) => [project, ...current]);
      onChange(selectedIds.includes(id) ? selectedIds : [...selectedIds, id]);
      setActiveProjectId(id);
      setProjectPosts([post]);
      setProjectQuery("");
    } catch {
      setCreateError("Нет сети или сервер не ответил.");
    } finally {
      setCreating(false);
    }
  }

  function toggleProject(projectId: string) {
    const selected = selectedIds.includes(projectId);
    if (selected) {
      onChange(selectedIds.filter((id) => id !== projectId));
      return;
    }
    onChange([...selectedIds, projectId]);
    setActiveProjectId(projectId);
  }

  function togglePost(nextPost: PostOption) {
    setProjectPosts((current) =>
      current.some((item) => item.id === nextPost.id)
        ? current.filter((item) => item.id !== nextPost.id)
        : [...current, nextPost],
    );
  }

  const projectPostsPayload =
    activeProjectId && selectedIds.includes(activeProjectId)
      ? { projectId: activeProjectId, postIds: projectPosts.map((item) => item.id) }
      : undefined;

  return (
    <section
      className="rounded-2xl border border-stone-200 bg-stone-50/60 px-3 py-3 sm:px-4"
      aria-label="Связанные подборки"
    >
      <input
        value={projectQuery}
        onChange={(event) => {
          setProjectQuery(event.target.value);
          setCreateError(null);
        }}
        placeholder="Найти или назвать подборку"
        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-stone-400 focus:border-stone-400"
        disabled={saving || creating}
      />

      {matchingProjects.length ? (
        <div className="mt-2.5 flex flex-wrap gap-1 px-0.5 pb-1 pt-0.5 sm:gap-1.5">
          {matchingProjects.map((project) => (
            <button
              key={project.id}
              type="button"
              disabled={saving}
              className={pillTabClass(selectedIds.includes(project.id))}
              onClick={() => toggleProject(project.id)}
            >
              {project.title}
            </button>
          ))}
        </div>
      ) : null}

      {normalizedProjectQuery && !hasExactTitle ? (
        <button
          type="button"
          className="mt-2 text-sm text-stone-600 underline decoration-stone-300 underline-offset-4 hover:text-stone-950 disabled:opacity-50"
          disabled={saving || creating}
          onClick={() => void createProject()}
        >
          {creating ? "Создаю…" : `Создать «${normalizedProjectQuery}»`}
        </button>
      ) : null}

      {activeProjectId ? (
        <div className="mt-3 border-t border-stone-200/80 pt-3">
          <input
            value={postQuery}
            onChange={(event) => setPostQuery(event.target.value)}
            placeholder="Найти публикацию"
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-stone-400 focus:border-stone-400"
            disabled={saving || loadingProjectPosts}
          />
          {loadingProjectPosts ? (
            <div className="mt-2 h-8 animate-pulse rounded-xl bg-stone-100" />
          ) : null}
          {projectPosts.length ? (
            <div className="mt-2 space-y-1">
              {projectPosts.map((item) => (
                <div
                  key={item.id}
                  className="flex min-w-0 items-center gap-2 rounded-xl bg-white px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-stone-700">
                    {postLabel(item)}
                  </span>
                  {item.id !== post.id ? (
                    <button
                      type="button"
                      aria-label={`Убрать «${postLabel(item)}»`}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50"
                      onClick={() => togglePost(item)}
                      disabled={saving}
                    >
                      <X size={15} />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          {postResults.filter((item) => !projectPosts.some((selected) => selected.id === item.id)).length ? (
            <div className="mt-2 space-y-1">
              {postResults
                .filter((item) => !projectPosts.some((selected) => selected.id === item.id))
                .slice(0, 8)
                .map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full min-w-0 items-center rounded-xl px-3 py-2 text-left text-sm text-stone-700 transition hover:bg-stone-100"
                    onClick={() => togglePost(item)}
                    disabled={saving}
                  >
                    <span className="truncate">{postLabel(item)}</span>
                  </button>
                ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {createError || message ? (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {createError ?? message}
        </p>
      ) : null}

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          className="rounded-full px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100 active:scale-[0.98] disabled:opacity-50"
          onClick={onCancel}
          disabled={saving || creating}
        >
          Отмена
        </button>
        <button
          type="button"
          className="rounded-full bg-stone-900 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-stone-800 active:scale-[0.98] disabled:opacity-50"
          onClick={() => onSave(selectedIds, projectPostsPayload)}
          disabled={saving || creating || loadingProjectPosts}
        >
          {saving ? "Сохраняю…" : "Сохранить"}
        </button>
      </div>
    </section>
  );
}
