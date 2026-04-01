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
import { SiteChrome } from "@/components/site/SiteChrome";
import { SiteFooter } from "@/components/site/SiteFooter";
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

function descriptionParagraphs(text: string): string[] {
  const sentences =
    text
      .split(/(?<=[.!?…])\s+/u)
      .map((part) => part.trim())
      .filter(Boolean) ?? [];
  if (sentences.length <= 1) return [text];
  if (sentences.length === 2) return sentences;
  return [sentences.slice(0, 2).join(" "), sentences.slice(2).join(" ")];
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
  const siteContext = [settings.tagline, settings.bio].filter(Boolean).join(" ");
  const category = await getSeoCategoryBySlug(slug, siteContext);
  if (!category || category.postCount === 0) {
    return {
      title: "Категория не найдена",
      robots: { index: false, follow: true },
    };
  }

  const titleBase = `${category.name} — категория | ${settings.displayName}`;
  const title = page > 1 ? `${titleBase}, стр. ${page}` : titleBase;
  const canonicalPath = pagePath(category.slug, page);
  const siteUrl = resolveSiteOrigin(settings.siteUrl);

  return {
    title,
    description: category.metaDescription,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description: category.metaDescription,
      url: absoluteUrl(siteUrl, canonicalPath),
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description: category.metaDescription,
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
  const siteContext = [settings.tagline, settings.bio].filter(Boolean).join(" ");
  const category = await getSeoCategoryBySlug(slug, siteContext);
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
        <div className="mt-2 space-y-2 text-sm leading-6 text-stone-600">
          {descriptionParagraphs(category.description).map((paragraph, idx) => (
            <p key={`${category.slug}-seo-${idx}`}>{paragraph}</p>
          ))}
        </div>
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

