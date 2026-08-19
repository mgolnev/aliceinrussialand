import Link from "next/link";
import { getAuthorName, getSiteSettings } from "@/lib/site";
import { listSeoCategories } from "@/lib/seo-content";
import { listPublishedProjectLinks } from "@/lib/projects";

export async function SiteFooter() {
  const settings = await getSiteSettings();
  const siteContext = [settings.tagline, settings.bio].filter(Boolean).join(" ");
  const [footerCategories, projects] = await Promise.all([
    listSeoCategories(siteContext),
    listPublishedProjectLinks(),
  ]);
  const authorName = getAuthorName(settings);

  return (
    <footer className="mt-14 border-t border-stone-200/70 bg-white/65 py-10 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 sm:px-5">
        {footerCategories.length > 0 ? (
          <nav aria-label="Разделы сайта" className="text-sm text-stone-600">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">
              Разделы
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              <Link
                href="/archive"
                className="underline decoration-stone-300 underline-offset-2 hover:text-stone-800"
              >
                Все публикации
              </Link>
              {footerCategories.map((category) => (
                <Link
                  key={category.id}
                  href={`/category/${category.slug}`}
                  className="underline decoration-stone-300 underline-offset-2 hover:text-stone-800"
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </nav>
        ) : null}
        {projects.length > 0 ? (
          <nav aria-label="Подборки работ" className="text-sm text-stone-600">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">
              Подборки
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.slug}`}
                  className="underline decoration-stone-300 underline-offset-2 hover:text-stone-800"
                >
                  {project.title}
                </Link>
              ))}
            </div>
          </nav>
        ) : null}
        <p className="text-center text-sm text-stone-500">
          © {new Date().getFullYear()} · {authorName} · авторская лента
        </p>
      </div>
    </footer>
  );
}
