import type { Metadata } from "next";
import { getSiteSettings, parseAvatarUrl } from "@/lib/site";
import { getFeedPage } from "@/lib/feed-server";
import { absoluteUrl } from "@/lib/absolute-url";
import { SiteFooter } from "@/components/site/SiteChrome";
import { HomePageClient } from "@/components/feed/HomePageClient";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";
import { cookies } from "next/headers";
import { resolveSiteOrigin } from "@/lib/site-origin";
import Link from "next/link";
import { getSeoCategoryBySlug } from "@/lib/seo-content";

type HomeProps = { searchParams: Promise<{ category?: string }> };

export async function generateMetadata({
  searchParams,
}: HomeProps): Promise<Metadata> {
  const sp = await searchParams;
  const categoryParam = sp.category?.trim() || "";
  const s = await getSiteSettings();
  const siteUrl = resolveSiteOrigin(s.siteUrl);
  const defaultDescription = s.tagline?.trim() || s.bio?.trim() || "Лента работ";
  const avatar = parseAvatarUrl(s.avatarMediaPath);
  const og = avatar ? absoluteUrl(siteUrl, avatar) : undefined;
  if (categoryParam) {
    const category = await getSeoCategoryBySlug(categoryParam, s.tagline || s.bio || "");
    const canonicalPath = category ? `/category/${category.slug}` : "/";
    const title = category ? `${category.name} — категория` : s.displayName;
    const description = category?.description || defaultDescription;

    return {
      title: { absolute: title },
      description,
      robots: { index: false, follow: true },
      alternates: { canonical: canonicalPath },
      openGraph: {
        title,
        description,
        url: absoluteUrl(siteUrl, canonicalPath),
        type: "website",
        images: og ? [{ url: og }] : undefined,
      },
      twitter: {
        card: og ? "summary_large_image" : "summary",
        title,
        description,
        images: og ? [og] : undefined,
      },
    };
  }

  return {
    title: { absolute: s.displayName },
    description: defaultDescription,
    alternates: { canonical: "/" },
    openGraph: {
      title: s.displayName,
      description: defaultDescription,
      url: absoluteUrl(siteUrl, "/"),
      type: "website",
      images: og ? [{ url: og }] : undefined,
    },
    twitter: {
      card: og ? "summary_large_image" : "summary",
      title: s.displayName,
      description: defaultDescription,
      images: og ? [og] : undefined,
    },
  };
}

export default async function HomePage({ searchParams }: HomeProps) {
  const sp = await searchParams;
  const categoryParam = sp.category?.trim() || undefined;
  const settingsPromise = getSiteSettings();
  const feedPromise = getFeedPage(undefined, categoryParam);
  const cookieStorePromise = cookies();
  const [settings, feed, cookieStore] = await Promise.all([
    settingsPromise,
    feedPromise,
    cookieStorePromise,
  ]);
  const { items, nextCursor, categories } = feed;
  const siteUrl = resolveSiteOrigin(settings.siteUrl);
  const plausible =
    settings.plausibleDomain || process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || "";
  const yandexMetrikaId =
    settings.yandexMetrikaId?.trim() ||
    process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID?.trim() ||
    "";
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const isAdmin = session ? await verifySessionToken(session) : false;
  const siteOrigin = siteUrl.replace(/\/$/, "");
  const webSiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteOrigin}#website`,
    url: siteOrigin,
    name: settings.displayName,
    inLanguage: settings.defaultLocale === "en" ? "en" : "ru",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd) }}
      />
      <HomePageClient
        displayName={settings.displayName}
        tagline={settings.tagline}
        avatarUrl={parseAvatarUrl(settings.avatarMediaPath)}
        contactsLabel={settings.contactsLabel}
        initialItems={items}
        initialNext={nextCursor}
        initialCategorySlug={categoryParam ?? null}
        categories={categories}
        plausibleDomain={plausible}
        yandexMetrikaId={yandexMetrikaId}
        siteUrl={siteUrl}
        canManage={isAdmin}
      />
      <div className="mx-auto mt-4 w-full max-w-3xl px-3 sm:px-5">
        <nav aria-label="Публичные ссылки по разделам" className="rounded-2xl border border-stone-200/80 bg-white/80 px-4 py-3 text-sm text-stone-600">
          <p className="mb-2 font-medium text-stone-800">Разделы</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/archive" className="underline decoration-stone-300 underline-offset-2">
              Архив публикаций
            </Link>
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/category/${category.slug}`}
                className="underline decoration-stone-300 underline-offset-2"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </nav>
      </div>
      <SiteFooter />
    </>
  );
}
