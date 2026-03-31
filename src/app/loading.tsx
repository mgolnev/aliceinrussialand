import { SiteChrome, SiteFooter } from "@/components/site/SiteChrome";
import { FeedPostsSkeleton } from "@/components/feed/FeedPostsSkeleton";
import { FeedHeaderTraySkeleton } from "@/components/feed/FeedHeaderTraySkeleton";
import { getSiteSettings, parseAvatarUrl } from "@/lib/site";

/** Скелетон главной при клиентском переходе (например, с поста на «Ленту»). */
export default async function HomeLoading() {
  const settings = await getSiteSettings();

  return (
    <>
      <SiteChrome
        displayName={settings.displayName}
        tagline={settings.tagline}
        avatarUrl={parseAvatarUrl(settings.avatarMediaPath)}
        contactsLabel={settings.contactsLabel}
        stickyTray={<FeedHeaderTraySkeleton variant="categories" />}
      />
      <div className="mx-auto min-w-0 max-w-3xl px-3 py-4 sm:px-5 sm:py-10">
        <FeedPostsSkeleton />
      </div>
      <SiteFooter />
    </>
  );
}
