import type { Metadata } from "next";
import { getSiteSettings, parseAvatarUrl } from "@/lib/site";
import { getFeedPage } from "@/lib/feed-server";
import { absoluteUrl } from "@/lib/absolute-url";
import { SiteFooter } from "@/components/site/SiteChrome";
import { HomePageClient } from "@/components/feed/HomePageClient";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";
import { cookies } from "next/headers";
import { resolveSiteOrigin } from "@/lib/site-origin";

type HomeProps = { searchParams: Promise<{ category?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const siteUrl = resolveSiteOrigin(s.siteUrl);
  const description =
    s.tagline?.trim() || s.bio?.trim() || "Лента работ";
  const avatar = parseAvatarUrl(s.avatarMediaPath);
  const og = avatar ? absoluteUrl(siteUrl, avatar) : undefined;

  return {
    title: { absolute: s.displayName },
    description,
    alternates: { canonical: "/" },
    openGraph: {
      title: s.displayName,
      description,
      url: absoluteUrl(siteUrl, "/"),
      type: "website",
      images: og ? [{ url: og }] : undefined,
    },
    twitter: {
      card: og ? "summary_large_image" : "summary",
      title: s.displayName,
      description,
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
      <SiteFooter />
    </>
  );
}
