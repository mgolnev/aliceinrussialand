"use client";

import { SiteChrome } from "@/components/site/SiteChrome";
import { QuickComposer } from "@/components/site/QuickComposer";
import { WanderEntry } from "@/components/wander/WanderEntry";
import { FeedScrollLinkCapture } from "./FeedScrollLinkCapture";
import { FeedCategoryBar } from "./FeedCategoryBar";
import { FeedPostsBody } from "./FeedPostsBody";
import { useFeedPage } from "./use-feed-page";
import type { FeedCategory, FeedPost } from "@/types/feed";
import { siteContentClass } from "@/lib/site-layout-styles";

type Props = {
  displayName: string;
  tagline: string;
  avatarUrl?: string | null;
  contactsLabel?: string;
  initialItems: FeedPost[];
  initialNext: string | null;
  initialCategorySlug: string | null;
  categories: FeedCategory[];
  showWanderEntry: boolean;
  wanderEntryLabel: string;
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
  showWanderEntry,
  wanderEntryLabel,
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
      <div className={siteContentClass()}>
        {showWanderEntry ? <WanderEntry label={wanderEntryLabel} /> : null}
        {canManage ? <QuickComposer categories={categories} /> : null}
        <FeedPostsBody
          items={feed.items}
          next={feed.next}
          loading={feed.loading}
          feedRestorePhase={feed.feedRestorePhase}
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
    </>
  );
}
