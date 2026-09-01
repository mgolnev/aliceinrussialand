"use client";

import Link from "next/link";
import { SiteChrome } from "@/components/site/SiteChrome";
import { QuickComposer } from "@/components/site/QuickComposer";
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
      <div className={siteContentClass()}>
        <div className="mb-5 flex justify-end sm:mb-8">
          <Link
            href="/wander"
            prefetch={false}
            className="group inline-flex min-h-11 items-center gap-3 text-sm tracking-tight text-stone-600 transition-colors hover:text-stone-950 focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            не выбирай <span aria-hidden className="transition-transform group-hover:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none">→</span>
          </Link>
        </div>
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
