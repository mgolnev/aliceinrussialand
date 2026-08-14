import Link from "next/link";
import type { PublishedProject } from "@/lib/projects";

export type ProjectTag = Pick<PublishedProject, "id" | "slug" | "title">;

/** Читаемый хэштег для публичной ссылки на подборку. */
export function projectTagLabel(title: string): string {
  const normalized = title
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return `#${normalized || "подборка"}`;
}

/** Один спокойный абзац внутри текста поста — без отдельной карточки и служебных подписей. */
export function PostProjectTags({
  projects,
  className = "mt-5 px-1 text-base leading-7 text-stone-700 sm:mt-6",
}: {
  projects: ProjectTag[];
  className?: string;
}) {
  if (!projects.length) return null;

  return (
    <p className={className}>
      {projects.map((project, index) => (
        <span key={project.id}>
          {index ? " " : null}
          <Link
            href={`/projects/${project.slug}`}
            className="underline decoration-stone-300 underline-offset-4 transition hover:text-stone-950 hover:decoration-stone-700"
          >
            {projectTagLabel(project.title)}
          </Link>
        </span>
      ))}
    </p>
  );
}
