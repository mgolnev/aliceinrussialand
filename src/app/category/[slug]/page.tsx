import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSiteSettings, parseAvatarUrl } from "@/lib/site";
import { absoluteUrl } from "@/lib/absolute-url";
import { resolveSiteOrigin } from "@/lib/site-origin";
import {
  getSeoCategoryBySlug,
  getSeoCategoryPostsPage,
  parsePageNumber,
} from "@/lib/seo-content";
import { SiteChrome, SiteFooter } from "@/components/site/SiteChrome";
import { SeoPostList } from "@/components/seo/SeoPostList";
import { SeoPager } from "@/components/seo/SeoPager";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
};

export const dynamic = "force-dynamic";

function pagePath(slug: string, page: number): string {
  if (page <= 1) return `/category/${slug}`;
  return `/category/${slug}?page=${page}`;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const [{ slug }, sp, settings] = await Promise.all([
    params,
    searchParams,
    getSiteSettings(),
  ]);
  const page = parsePageNumber(sp.page);
  const category = await getSeoCategoryBySlug(slug, settings.tagline || settings.bio || "");
  if (!category || category.postCount === 0) {
    return {
      title: "Категория не найдена",
      robots: { index: false, follow: true },
    };
  }

  const titleBase = `${category.name} — категория`;
  const title = page > 1 ? `${titleBase}, стр. ${page}` : titleBase;
  const canonicalPath = pagePath(category.slug, page);
  const siteUrl = resolveSiteOrigin(settings.siteUrl);

  return {
    title,
    description: category.description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description: category.description,
      url: absoluteUrl(siteUrl, canonicalPath),
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description: category.description,
    },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const [{ slug }, sp, settings] = await Promise.all([
    params,
    searchParams,
    getSiteSettings(),
  ]);
  const page = parsePageNumber(sp.page);
  const category = await getSeoCategoryBySlug(slug, settings.tagline || settings.bio || "");
  if (!category || category.postCount === 0) notFound();

  const postsPage = await getSeoCategoryPostsPage(category.id, page);
  const siteUrl = resolveSiteOrigin(settings.siteUrl);
  const categoryUrl = absoluteUrl(siteUrl, pagePath(category.slug, postsPage.page));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${categoryUrl}#collection`,
    url: categoryUrl,
    name: `${category.name} — категория`,
    description: category.description,
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
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{category.name}</h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">{category.description}</p>
        <p className="mt-3 text-sm text-stone-600">
          В категории {category.postCount} публикаций.{" "}
          <Link href={`/?category=${encodeURIComponent(category.slug)}`} className="underline">
            Открыть в режиме ленты
          </Link>
        </p>
        <section className="mt-5">
          <SeoPostList items={postsPage.items} emptyText="В этой категории пока нет опубликованных материалов." />
          <SeoPager
            basePath={`/category/${category.slug}`}
            page={postsPage.page}
            total={postsPage.total}
            pageSize={postsPage.pageSize}
          />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

