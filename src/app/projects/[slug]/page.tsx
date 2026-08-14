import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getSiteSettings, parseAvatarUrl } from "@/lib/site";
import { absoluteUrl } from "@/lib/absolute-url";
import { resolveSiteOrigin } from "@/lib/site-origin";
import { excerptForMetaDescription } from "@/lib/meta-excerpt";
import { getPublishedProjectBySlugCached } from "@/lib/projects";
import { parseVariants } from "@/lib/posts-query";
import { listFeedCategories } from "@/lib/feed-server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";
import { SiteChrome } from "@/components/site/SiteChrome";
import { SiteFooter } from "@/components/site/SiteFooter";
import { BackToFeedButton } from "@/components/feed/BackToFeedButton";
import { PostCard } from "@/components/feed/PostCard";
import type { FeedPost } from "@/types/feed";

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
  const [project, settings, cookieStore, categories] = await Promise.all([
    getPublishedProjectBySlugCached(slug),
    getSiteSettings(),
    cookies(),
    listFeedCategories(),
  ]);
  if (!project) notFound();

  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const isAdmin = session ? await verifySessionToken(session) : false;
  const siteUrl = resolveSiteOrigin(settings.siteUrl);
  const plausible =
    settings.plausibleDomain || process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || "";
  const yandexMetrikaId =
    settings.yandexMetrikaId?.trim() ||
    process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID?.trim() ||
    "";
  const path = `/projects/${project.slug}`;
  const url = absoluteUrl(siteUrl, path);
  const description = projectDescription(project.description, project.title);
  const feedPosts: FeedPost[] = project.posts.map((post) => ({
    id: post.id,
    slug: post.slug,
    title: post.title,
    body: post.body,
    displayMode: post.displayMode === "STACK" ? "STACK" : "GRID",
    publishedAt: post.publishedAt?.toISOString() ?? null,
    pinned: post.pinned,
    showInAll: post.showInAll,
    categoryId: post.categoryId,
    category: post.category,
    images: post.images.map((image) => ({
      id: image.id,
      caption: image.caption,
      alt: image.alt,
      variants: parseVariants(image.variantsJson),
      width: image.width,
      height: image.height,
    })),
  }));
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
      <main className="mx-auto max-w-3xl px-3 py-4 sm:px-5 sm:py-10">
        <div className="relative flex min-h-11 items-center justify-center">
          <div className="absolute left-0">
            <BackToFeedButton variant="pill" />
          </div>
          <h1 className="max-w-[calc(100%-8rem)] truncate text-center text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">
            {project.title}
          </h1>
        </div>
        <section className="mt-4 space-y-4 sm:mt-6 sm:space-y-7" aria-label="Публикации подборки">
          {feedPosts.map((post, index) => (
            <PostCard
              key={post.id}
              post={post}
              categories={categories}
              plausibleDomain={plausible}
              yandexMetrikaId={yandexMetrikaId}
              siteUrl={siteUrl}
              canManage={isAdmin}
              prioritizeMedia={index === 0}
            />
          ))}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
