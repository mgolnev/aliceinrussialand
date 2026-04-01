import type { Metadata } from "next";
import { PostBackTray } from "@/components/feed/PostBackTray";
import {
  getSiteSettings,
  parseAboutPhotoUrl,
  parseAvatarUrl,
  parseSocialLinks,
} from "@/lib/site";
import { absoluteUrl } from "@/lib/absolute-url";
import { excerptForMetaDescription } from "@/lib/meta-excerpt";
import { SiteChrome } from "@/components/site/SiteChrome";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SocialLinksSection } from "@/components/site/SocialLinksSection";
import { resolveSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

function aboutPageDescription(s: {
  displayName: string;
  bio: string;
  tagline: string;
  contactsLabel: string;
}): string {
  const bio = s.bio?.trim();
  const tag = s.tagline?.trim();
  const name = s.displayName?.trim() || "Автор";
  const contactsWord = (s.contactsLabel?.trim() || "Контакты").replace(
    /[.!?…]+$/,
    "",
  );
  const raw =
    bio ||
    tag ||
    `${name} — страница автора: ${contactsWord.toLowerCase()} и ссылки на соцсети.`;
  return excerptForMetaDescription(raw, 160);
}

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const siteUrl = resolveSiteOrigin(s.siteUrl);
  const description = aboutPageDescription(s);
  const aboutImg = parseAboutPhotoUrl(s.aboutPhotoPath);
  const avatar = parseAvatarUrl(s.avatarMediaPath);
  const ogPath = aboutImg || avatar;
  const og = ogPath ? absoluteUrl(siteUrl, ogPath) : undefined;
  const title = "Обо мне";

  return {
    title,
    description,
    alternates: { canonical: "/about" },
    openGraph: {
      title,
      description,
      url: absoluteUrl(siteUrl, "/about"),
      type: "website",
      images: og ? [{ url: og }] : undefined,
    },
    twitter: {
      card: og ? "summary_large_image" : "summary",
      title,
      description,
      images: og ? [og] : undefined,
    },
  };
}

export default async function AboutPage() {
  const s = await getSiteSettings();
  const social = parseSocialLinks(s.socialLinksJson);
  const aboutPhotoUrl = parseAboutPhotoUrl(s.aboutPhotoPath);
  const siteUrl = resolveSiteOrigin(s.siteUrl);
  const pageUrl = absoluteUrl(siteUrl, "/about");
  const avatarUrl = parseAvatarUrl(s.avatarMediaPath);
  const profileImageAbs = aboutPhotoUrl
    ? absoluteUrl(siteUrl, aboutPhotoUrl)
    : avatarUrl
      ? absoluteUrl(siteUrl, avatarUrl)
      : undefined;
  const sameAs = social
    .map((x) => x.url.trim())
    .filter((u) => /^https?:\/\//i.test(u));
  const metaDescription = aboutPageDescription(s);
  const personDescription =
    s.bio?.trim() || s.tagline?.trim() || metaDescription;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        url: pageUrl,
        name: "Обо мне",
        description: metaDescription,
        isPartOf: {
          "@type": "WebSite",
          "@id": `${siteUrl.replace(/\/$/, "")}#website`,
          name: s.displayName,
          url: siteUrl.replace(/\/$/, ""),
        },
        ...(profileImageAbs
          ? {
              primaryImageOfPage: {
                "@type": "ImageObject",
                url: profileImageAbs,
              },
            }
          : {}),
        mainEntity: { "@id": `${pageUrl}#person` },
      },
      {
        "@type": "Person",
        "@id": `${pageUrl}#person`,
        name: s.displayName,
        url: pageUrl,
        ...(profileImageAbs ? { image: profileImageAbs } : {}),
        description: personDescription.slice(0, 500),
        ...(sameAs.length ? { sameAs } : {}),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <SiteChrome
        displayName={s.displayName}
        tagline={s.tagline}
        avatarUrl={parseAvatarUrl(s.avatarMediaPath)}
        contactsLabel={s.contactsLabel}
        stickyTray={<PostBackTray />}
      />
      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-5 sm:py-10">
        <article className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
            Обо мне
          </h1>
          {aboutPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={aboutPhotoUrl}
              alt={s.displayName}
              className="mt-6 w-full rounded-2xl object-cover shadow-md"
            />
          ) : null}
          {s.bio ? (
            <p className="mt-6 text-lg text-stone-700">{s.bio}</p>
          ) : null}
          <div className="mt-8 whitespace-pre-wrap text-[1.05rem] leading-relaxed text-stone-800">
            {s.aboutMarkdown || "Текст можно задать в админке → Настройки."}
          </div>
          <SocialLinksSection social={social} contactsLabel={s.contactsLabel} />
        </article>
      </div>
      <SiteFooter />
    </>
  );
}
