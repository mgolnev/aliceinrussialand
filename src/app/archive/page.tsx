import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/absolute-url";
import { getSiteSettings, parseAvatarUrl } from "@/lib/site";
import { resolveSiteOrigin } from "@/lib/site-origin";
import { getArchivePostsPage, parsePageNumber } from "@/lib/seo-content";
import { SiteChrome } from "@/components/site/SiteChrome";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SeoPostList } from "@/components/seo/SeoPostList";
import { SeoPager } from "@/components/seo/SeoPager";

type ArchivePageProps = {
  searchParams: Promise<{ page?: string }>;
};

export const dynamic = "force-dynamic";

function archivePath(page: number): string {
  if (page <= 1) return "/archive";
  return `/archive?page=${page}`;
}

export async function generateMetadata({
  searchParams,
}: ArchivePageProps): Promise<Metadata> {
  const [sp, settings] = await Promise.all([searchParams, getSiteSettings()]);
  const page = parsePageNumber(sp.page);
  const title = page > 1 ? `Архив публикаций, стр. ${page}` : "Архив публикаций";
  const description = "Публичный архив всех опубликованных материалов.";
  const canonicalPath = archivePath(page);
  const siteUrl = resolveSiteOrigin(settings.siteUrl);

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title,
      description,
      url: absoluteUrl(siteUrl, canonicalPath),
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function ArchivePage({ searchParams }: ArchivePageProps) {
  const [sp, settings] = await Promise.all([searchParams, getSiteSettings()]);
  const page = parsePageNumber(sp.page);
  const archive = await getArchivePostsPage(page);

  return (
    <>
      <SiteChrome
        displayName={settings.displayName}
        tagline={settings.tagline}
        avatarUrl={parseAvatarUrl(settings.avatarMediaPath)}
        contactsLabel={settings.contactsLabel}
      />
      <main className="mx-auto max-w-3xl px-3 py-4 sm:px-5 sm:py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Архив публикаций
        </h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          HTML-архив для стабильного обхода всех материалов поисковыми роботами.
        </p>
        <section className="mt-5">
          <SeoPostList items={archive.items} emptyText="Архив пока пуст." />
          <SeoPager
            basePath="/archive"
            page={archive.page}
            total={archive.total}
            pageSize={archive.pageSize}
          />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

