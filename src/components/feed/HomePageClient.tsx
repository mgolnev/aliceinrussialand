"use client";

import { SiteChrome } from "@/components/site/SiteChrome";
import { QuickComposer } from "@/components/site/QuickComposer";
import { FeedScrollLinkCapture } from "./FeedScrollLinkCapture";
import { FeedCategoryBar } from "./FeedCategoryBar";
import { FeedPostsBody } from "./FeedPostsBody";
import { useFeedPage } from "./use-feed-page";
import type { FeedCategory, FeedPost } from "@/types/feed";

type Props = {
  displayName: string;
  tagline: string;
  avatarUrl?: string | null;
  contactsLabel?: string;
  initialItems: FeedPost[];
  initialNext: string | null;
  initialCategorySlug: string | null;
  categories: FeedCategory[];
  plausibleDomain?: string;
  yandexMetrikaId?: string;
  siteUrl: string;
  canManage: boolean;
};

export function HomePageClient({
  displayName,
  tagline,
  avatarUrl,
  contactsLabel,
  initialItems,
  initialNext,
  initialCategorySlug,
  categories,
  plausibleDomain,
  yandexMetrikaId,
  siteUrl,
  canManage,
}: Props) {
  const feed = useFeedPage({
    initialItems,
    initialNext,
    initialCategorySlug,
  });

  return (
    <>
      <FeedScrollLinkCapture />
      <SiteChrome
        displayName={displayName}
        tagline={tagline}
        avatarUrl={avatarUrl}
        contactsLabel={contactsLabel}
        stickyTray={
          categories.length > 0 ? (
            <FeedCategoryBar
              variant="header"
              categories={categories}
              activeSlug={feed.categorySlug}
              onSelect={feed.applyCategory}
            />
          ) : undefined
        }
      />
      <div className="mx-auto min-w-0 max-w-3xl px-3 py-4 sm:px-5 sm:py-10">
        {canManage ? <QuickComposer categories={categories} /> : null}
        <div className="mt-4 sm:mt-0">
          <FeedPostsBody
            items={feed.items}
            next={feed.next}
            loading={feed.loading}
            categoryLoading={feed.categoryLoading}
            loadMore={feed.loadMore}
            categorySlug={feed.categorySlug}
            categories={categories}
            plausibleDomain={plausibleDomain}
            yandexMetrikaId={yandexMetrikaId}
            siteUrl={siteUrl}
            canManage={canManage}
            empty={feed.empty}
            sentinelRef={feed.sentinelRef}
          />
        </div>
      </div>
    </>
  );
}
