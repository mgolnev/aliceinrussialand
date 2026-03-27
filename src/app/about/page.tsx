import type { Metadata } from "next";
import Link from "next/link";
import {
  getSiteSettings,
  parseAboutPhotoUrl,
  parseAvatarUrl,
  parseSocialLinks,
} from "@/lib/site";
import { SiteChrome, SiteFooter } from "@/components/site/SiteChrome";
import { SocialLinksSection } from "@/components/site/SocialLinksSection";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  return {
    title: "Обо мне",
    description: s.bio || s.tagline,
    alternates: { canonical: "/about" },
  };
}

export default async function AboutPage() {
  const s = await getSiteSettings();
  const social = parseSocialLinks(s.socialLinksJson);
  const aboutPhotoUrl = parseAboutPhotoUrl(s.aboutPhotoPath);

  return (
    <>
      <SiteChrome
        displayName={s.displayName}
        tagline={s.tagline}
        avatarUrl={parseAvatarUrl(s.avatarMediaPath)}
        contactsLabel={s.contactsLabel}
      />
      <article className="mx-auto max-w-2xl px-3 py-10 sm:px-5 sm:py-12">
        <nav className="mb-8 text-sm text-stone-600">
          <Link href="/" className="hover:text-stone-900 hover:underline">
            ← Лента
          </Link>
        </nav>
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
      <SiteFooter />
    </>
  );
}
