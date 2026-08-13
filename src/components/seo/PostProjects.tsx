import Link from "next/link";
import type { PublishedProject } from "@/lib/projects";
import { derivePostTitle } from "@/lib/post-text";

type Props = {
  projects: PublishedProject[];
  currentPostId: string;
};

/** Точная, авторская перелинковка. Она идёт перед алгоритмическими рекомендациями. */
export function PostProjects({ projects, currentPostId }: Props) {
  if (projects.length === 0) return null;

  return (
    <section className="mt-6 border-t border-stone-200/80 pt-6 sm:mt-8 sm:pt-8" aria-label="Связанные циклы">
      <div className="space-y-5">
        {projects.map((project) => (
          <div
            key={project.id}
            className="rounded-[24px] border border-stone-200/80 bg-white/90 p-4 sm:rounded-[28px] sm:p-5"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
              Из цикла
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">
              <Link href={`/projects/${project.slug}`} className="hover:underline">
                {project.title}
              </Link>
            </h2>
            {project.description.trim() ? (
              <p className="mt-2 text-sm leading-6 text-stone-600">
                {project.description.trim()}
              </p>
            ) : null}
            <ol className="mt-4 space-y-2 border-t border-stone-100 pt-3">
              {project.posts.map((post, index) => {
                const current = post.id === currentPostId;
                const title = derivePostTitle(post.title, post.body);
                return (
                  <li key={post.id} className="flex min-w-0 items-baseline gap-2 text-sm">
                    <span className="w-5 shrink-0 text-right tabular-nums text-stone-400">
                      {index + 1}.
                    </span>
                    {current ? (
                      <span aria-current="page" className="font-medium text-stone-900">
                        {title}
                      </span>
                    ) : (
                      <Link
                        href={`/p/${post.slug}`}
                        className="text-stone-700 underline decoration-stone-300 underline-offset-4 transition hover:text-stone-950 hover:decoration-stone-700"
                      >
                        {title}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
            <Link
              href={`/projects/${project.slug}`}
              className="mt-4 inline-flex text-sm font-medium text-stone-700 underline decoration-stone-300 underline-offset-4 transition hover:text-stone-950 hover:decoration-stone-700"
            >
              Все материалы цикла
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
