import { getSiteSettings, parseAvatarUrl } from "@/lib/site";
import { getFeedPage } from "@/lib/feed-server";
import { SiteFooter } from "@/components/site/SiteChrome";
import { HomePageClient } from "@/components/feed/HomePageClient";
import { FeedScrollRestore } from "@/components/feed/FeedScrollRestore";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";
import { cookies } from "next/headers";

type HomeProps = { searchParams: Promise<{ category?: string }> };

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
      <FeedScrollRestore />
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
