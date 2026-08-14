import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteSettings, parseAvatarUrl } from "@/lib/site";
import { absoluteUrl } from "@/lib/absolute-url";
import { resolveSiteOrigin } from "@/lib/site-origin";
import { excerptForMetaDescription } from "@/lib/meta-excerpt";
import { getPublishedProjectBySlugCached } from "@/lib/projects";
import { SiteChrome } from "@/components/site/SiteChrome";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SeoPostList } from "@/components/seo/SeoPostList";

type PageProps = { params: Promise<{ slug: string }> };

/** Контент зависит от БД и должен читаться в момент запроса. */
export const dynamic = "force-dynamic";

function projectDescription(
  description: string,
  title: string,
): string {
  return (
    description.trim() ||
    `Все публикации о работе «${title}».`
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [project, settings] = await Promise.all([
    getPublishedProjectBySlugCached(slug),
    getSiteSettings(),
  ]);
  if (!project) {
    return {
      title: "Подборка не найдена",
      robots: { index: false, follow: true },
    };
  }

  const description = excerptForMetaDescription(
    project.metaDescription.trim() || projectDescription(project.description, project.title),
    180,
  );
  const title = project.metaTitle.trim() || `${project.title} — ${settings.displayName}`;
  const siteUrl = resolveSiteOrigin(settings.siteUrl);
  const path = `/projects/${project.slug}`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: absoluteUrl(siteUrl, path),
      type: "website",
    },
    twitter: { card: "summary", title, description },
  };
}

export default async function ProjectPage({ params }: PageProps) {
  const { slug } = await params;
  const [project, settings] = await Promise.all([
    getPublishedProjectBySlugCached(slug),
    getSiteSettings(),
  ]);
  if (!project) notFound();

  const siteUrl = resolveSiteOrigin(settings.siteUrl);
  const path = `/projects/${project.slug}`;
  const url = absoluteUrl(siteUrl, path);
  const description = projectDescription(project.description, project.title);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    url,
    name: project.title,
    description,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: project.posts.length,
      itemListElement: project.posts.map((post, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(siteUrl, `/p/${post.slug}`),
        name: post.title,
      })),
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteChrome
        displayName={settings.displayName}
        tagline={settings.tagline}
        avatarUrl={parseAvatarUrl(settings.avatarMediaPath)}
        contactsLabel={settings.contactsLabel}
      />
      <main className="mx-auto max-w-3xl px-3 py-4 sm:px-5 sm:py-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
          Материалы о работе
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          {project.title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600 sm:text-base">
          {description}
        </p>
        <section className="mt-6 sm:mt-8" aria-label="Публикации подборки">
          <SeoPostList
            items={project.posts}
            emptyText="В этой подборке пока нет опубликованных материалов."
          />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
