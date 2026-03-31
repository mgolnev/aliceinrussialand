import type { Metadata } from "next";
import { getSiteSettings, parseAvatarUrl } from "@/lib/site";
import { getFeedPage } from "@/lib/feed-server";
import { absoluteUrl } from "@/lib/absolute-url";
import { SiteFooter } from "@/components/site/SiteChrome";
import { HomePageClient } from "@/components/feed/HomePageClient";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";
import { cookies } from "next/headers";

type HomeProps = { searchParams: Promise<{ category?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const siteUrl =
    s.siteUrl ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
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
  const settings = await getSiteSettings();
  const { items, nextCursor, categories } = await getFeedPage(
    undefined,
    categoryParam,
  );
  const siteUrl =
    settings.siteUrl ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const plausible =
    settings.plausibleDomain || process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || "";
  const yandexMetrikaId =
    settings.yandexMetrikaId?.trim() ||
    process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID?.trim() ||
    "";
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const isAdmin = session ? await verifySessionToken(session) : false;

  return (
    <>
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
