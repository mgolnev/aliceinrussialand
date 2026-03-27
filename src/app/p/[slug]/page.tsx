import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import {
  getPublishedPostBySlug,
  parseVariants,
} from "@/lib/posts-query";
import { getSiteSettings, parseAvatarUrl } from "@/lib/site";
import { absoluteUrl } from "@/lib/absolute-url";
import { SiteChrome, SiteFooter } from "@/components/site/SiteChrome";
import { PostCard } from "@/components/feed/PostCard";
import type { FeedPost } from "@/types/feed";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/session";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPostBySlug(slug);
  if (!post) return { title: "Не найдено" };

  const settings = await getSiteSettings();
  const siteUrl =
    settings.siteUrl ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";
  const title = post.metaTitle || post.title;
  const description = post.metaDescription || post.body.slice(0, 160);
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
  const post = await getPublishedPostBySlug(slug);
  if (!post) notFound();

  const settings = await getSiteSettings();
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

  const feedPost: FeedPost = {
    id: post.id,
    slug: post.slug,
    title: post.title,
    body: post.body,
    displayMode: post.displayMode === "STACK" ? "STACK" : "GRID",
    publishedAt: post.publishedAt?.toISOString() ?? null,
    pinned: post.pinned,
    images: post.images.map((im) => ({
      id: im.id,
      caption: im.caption,
      alt: im.alt,
      variants: parseVariants(im.variantsJson),
      width: im.width,
      height: im.height,
    })),
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    datePublished: post.publishedAt?.toISOString(),
    image: feedPost.images
      .map((im) => siteUrl.replace(/\/$/, "") + (im.variants.w1280 || ""))
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
      />
      <div className="mx-auto max-w-3xl px-3 py-8 sm:px-5 sm:py-10">
        <nav className="mb-6 text-sm text-stone-600">
          <Link href="/" className="hover:text-stone-900 hover:underline">
            ← На главную ленту
          </Link>
        </nav>
        <PostCard
          post={feedPost}
          plausibleDomain={plausible}
          yandexMetrikaId={yandexMetrikaId}
          siteUrl={siteUrl}
          canManage={isAdmin}
          standalone
        />
      </div>
      <SiteFooter />
    </>
  );
}
