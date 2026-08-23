import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthorName, getSiteSettings, parseAvatarUrl } from "@/lib/site";
import { absoluteUrl } from "@/lib/absolute-url";
import { resolveSiteOrigin } from "@/lib/site-origin";
import { excerptForMetaDescription } from "@/lib/meta-excerpt";
import {
  getPublishedProjectBySlugCached,
  getPublishedProjectPostsPageCached,
  projectPostToFeedPost,
} from "@/lib/projects";
import { listFeedCategories } from "@/lib/feed-server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";
import { cookies } from "next/headers";
import { SiteChrome } from "@/components/site/SiteChrome";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PostBackTray } from "@/components/feed/PostBackTray";
import { siteContentClass } from "@/lib/site-layout-styles";
import type { FeedCategory, FeedPost } from "@/types/feed";
import { buildSeoDocumentTitle } from "@/lib/seo-document-title";
import { parsePageNumber } from "@/lib/seo-content";
import { ProjectPostsFeed } from "@/components/feed/ProjectPostsFeed";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

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

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const page = parsePageNumber(sp.page);
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
  const authorName = getAuthorName(settings);
  const baseTitle = project.metaTitle.trim() || `${project.title} — подборка работ`;
  const title = buildSeoDocumentTitle(
    page > 1 ? `${baseTitle}, страница ${page}` : baseTitle,
    authorName,
  );
  const siteUrl = resolveSiteOrigin(settings.siteUrl);
  const path = page > 1
    ? `/projects/${project.slug}?page=${page}`
    : `/projects/${project.slug}`;

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

export default async function ProjectPage({ params, searchParams }: PageProps) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const page = parsePageNumber(sp.page);
  const [project, settings, cookieStore] = await Promise.all([
    getPublishedProjectBySlugCached(slug),
    getSiteSettings(),
    cookies(),
  ]);
  if (!project) notFound();
  const postsPage = await getPublishedProjectPostsPageCached(
    project.id,
    project.orderMode,
    page,
  );
  if (page > 1 && !postsPage.items.length) notFound();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const canManage = sessionToken ? await verifySessionToken(sessionToken) : false;
  const categories: FeedCategory[] = canManage ? await listFeedCategories() : [];
  const siteUrl = resolveSiteOrigin(settings.siteUrl);
  const plausible =
    settings.plausibleDomain || process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || "";
  const yandexMetrikaId =
    settings.yandexMetrikaId?.trim() ||
    process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID?.trim() ||
    "";
  const path = page > 1
    ? `/projects/${project.slug}?page=${page}`
    : `/projects/${project.slug}`;
  const url = absoluteUrl(siteUrl, path);
  const description = projectDescription(project.description, project.title);
  const authorName = getAuthorName(settings);
  const feedPosts: FeedPost[] = postsPage.items.map(projectPostToFeedPost);
  const nextPage =
    postsPage.page * postsPage.pageSize < postsPage.total
      ? postsPage.page + 1
      : null;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#collection`,
    url,
    name: project.title,
    description,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: postsPage.total,
      itemListElement: postsPage.items.map((post, index) => ({
        "@type": "ListItem",
        position: (postsPage.page - 1) * postsPage.pageSize + index + 1,
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
        stickyTray={<PostBackTray title={project.title} />}
      />
      <main className={siteContentClass()}>
        <h1 className="sr-only">
          {project.title} — подборка работ {authorName}
        </h1>
        <ProjectPostsFeed
          key={`${project.slug}-${postsPage.page}`}
          projectSlug={project.slug}
          initialItems={feedPosts}
          initialNextPage={nextPage}
          categories={categories}
          plausibleDomain={plausible}
          yandexMetrikaId={yandexMetrikaId}
          siteUrl={siteUrl}
          canManage={canManage}
        />
      </main>
      <SiteFooter />
    </>
  );
}
