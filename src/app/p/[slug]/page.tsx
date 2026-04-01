import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import {
  getPostCarouselPeersCached,
  getPublishedPostBySlugCached,
  parseVariants,
} from "@/lib/posts-query";
import { listFeedCategories } from "@/lib/feed-server";
import { getSiteSettings, parseAvatarUrl } from "@/lib/site";
import { absoluteUrl } from "@/lib/absolute-url";
import { excerptForMetaDescription } from "@/lib/meta-excerpt";
import { buildImplicitPostDocumentTitle } from "@/lib/post-document-title";
import { stripEmojiForSeo } from "@/lib/seo-sanitize";
import { SiteChrome } from "@/components/site/SiteChrome";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PostBackTray } from "@/components/feed/PostBackTray";
import { PostCard } from "@/components/feed/PostCard";
import { PostReadNextCarousel } from "@/components/feed/PostReadNextCarousel";
import type { FeedCategory, FeedPost } from "@/types/feed";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";
import { resolveSiteOrigin } from "@/lib/site-origin";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [post, settings] = await Promise.all([
    getPublishedPostBySlugCached(slug),
    getSiteSettings(),
  ]);
  if (!post) {
    return {
      title: "Не найдено",
      robots: { index: false, follow: false },
    };
  }
  const siteUrl = resolveSiteOrigin(settings.siteUrl);
  const metaTitleTrim = post.metaTitle?.trim() ?? "";
  const titleRaw = metaTitleTrim
    ? metaTitleTrim
    : buildImplicitPostDocumentTitle(
        post.title,
        settings.displayName,
        post.category?.name,
      );
  const descriptionRaw =
    post.metaDescription?.trim() || excerptForMetaDescription(post.body);
  /** В выдаче и соцсетях — без эмодзи; текст поста на странице не меняем. */
  const title = stripEmojiForSeo(titleRaw) || titleRaw.trim() || "Публикация";
  const description = stripEmojiForSeo(descriptionRaw) || descriptionRaw.trim();
  const first = post.images[0];
  const og =
    first && parseVariants(first.variantsJson).w1280
      ? absoluteUrl(siteUrl, parseVariants(first.variantsJson).w1280)
      : undefined;

  return {
    title,
    description,
    alternates: { canonical: `/p/${post.slug}` },
    openGraph: {
      title,
      description,
      url: absoluteUrl(siteUrl, `/p/${post.slug}`),
      type: "article",
      publishedTime: post.publishedAt?.toISOString(),
      images: og ? [{ url: og }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: og ? [og] : undefined,
    },
  };
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;
  const [post, settings, cookieStore] = await Promise.all([
    getPublishedPostBySlugCached(slug),
    getSiteSettings(),
    cookies(),
  ]);
  if (!post) notFound();

  const siteUrl = resolveSiteOrigin(settings.siteUrl);
  const plausible =
    settings.plausibleDomain || process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN || "";
  const yandexMetrikaId =
    settings.yandexMetrikaId?.trim() ||
    process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID?.trim() ||
    "";
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const isAdmin = session ? await verifySessionToken(session) : false;
  const readNextItems = await getPostCarouselPeersCached(
    post.id,
    post.categoryId,
  );
  const allFeedCategories: FeedCategory[] = await listFeedCategories();

  const feedPost: FeedPost = {
    id: post.id,
    slug: post.slug,
    title: post.title,
    body: post.body,
    displayMode: post.displayMode === "STACK" ? "STACK" : "GRID",
    publishedAt: post.publishedAt?.toISOString() ?? null,
    pinned: post.pinned,
    categoryId: post.categoryId,
    category: post.category,
    images: post.images.map((im) => ({
      id: im.id,
      caption: im.caption,
      alt: im.alt,
      variants: parseVariants(im.variantsJson),
      width: im.width,
      height: im.height,
    })),
  };

  const postUrl = absoluteUrl(siteUrl, `/p/${post.slug}`);
  const aboutUrl = absoluteUrl(siteUrl, "/about");
  const avatarPath = parseAvatarUrl(settings.avatarMediaPath);
  const publisherLogo = avatarPath ? absoluteUrl(siteUrl, avatarPath) : undefined;
  const articleDescription =
    post.metaDescription?.trim() || excerptForMetaDescription(post.body);
  const articleHeadline =
    post.title?.trim() ||
    buildImplicitPostDocumentTitle(post.title, settings.displayName, post.category?.name);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${postUrl}#article`,
    url: postUrl,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": postUrl,
    },
    headline: articleHeadline,
    description: articleDescription,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt?.toISOString() ?? post.publishedAt?.toISOString(),
    author: {
      "@type": "Person",
      name: settings.displayName,
      url: aboutUrl,
    },
    publisher: {
      "@type": "Organization",
      name: settings.displayName,
      ...(publisherLogo
        ? {
            logo: {
              "@type": "ImageObject",
              url: publisherLogo,
            },
          }
        : {}),
    },
    image: feedPost.images
      .map((im) => {
        const path = im.variants.w1280;
        return path ? absoluteUrl(siteUrl, path) : "";
      })
      .filter(Boolean),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteChrome
        displayName={settings.displayName}
        tagline={settings.tagline}
        avatarUrl={parseAvatarUrl(settings.avatarMediaPath)}
        contactsLabel={settings.contactsLabel}
        stickyTray={<PostBackTray />}
      />
      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-5 sm:py-10">
        <PostCard
          post={feedPost}
          categories={isAdmin ? allFeedCategories : []}
          plausibleDomain={plausible}
          yandexMetrikaId={yandexMetrikaId}
          siteUrl={siteUrl}
          canManage={isAdmin}
          prioritizeMedia
          standalone
        />
        <PostReadNextCarousel
          items={readNextItems}
          categories={allFeedCategories}
          currentPostCategoryId={post.categoryId}
        />
      </div>
      <SiteFooter />
    </>
  );
}
