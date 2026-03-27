import {
  getSiteSettings,
  parseAvatarUrl,
  parseSocialLinks,
} from "@/lib/site";
import { getFeedPage } from "@/lib/feed-server";
import { SiteChrome, SiteFooter } from "@/components/site/SiteChrome";
import { FeedClient } from "@/components/feed/FeedClient";
import { FeedScrollRestore } from "@/components/feed/FeedScrollRestore";
import { QuickComposer } from "@/components/site/QuickComposer";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";
import { cookies } from "next/headers";

export default async function HomePage() {
  const settings = await getSiteSettings();
  const social = parseSocialLinks(settings.socialLinksJson);
  const { items, nextCursor } = await getFeedPage();
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
      <SiteChrome
        displayName={settings.displayName}
        tagline={settings.tagline}
        social={social}
        avatarUrl={parseAvatarUrl(settings.avatarMediaPath)}
      />
      <div className="mx-auto min-w-0 max-w-3xl px-4 py-4 sm:px-6 sm:py-10">
        {isAdmin ? <QuickComposer siteUrl={siteUrl} /> : null}
        <div className="mt-4 sm:mt-0">
          <FeedClient
            initialItems={items}
            initialNext={nextCursor}
            plausibleDomain={plausible}
            yandexMetrikaId={yandexMetrikaId}
            siteUrl={siteUrl}
            canManage={isAdmin}
          />
        </div>
      </div>
      <SiteFooter />
    </>
  );
}
