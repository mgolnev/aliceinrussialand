import type { Metadata } from "next";
import Link from "next/link";
import {
  getSiteSettings,
  parseAvatarUrl,
  parseSocialLinks,
} from "@/lib/site";
import { SiteChrome, SiteFooter } from "@/components/site/SiteChrome";

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

  return (
    <>
      <SiteChrome
        displayName={s.displayName}
        tagline={s.tagline}
        social={social}
        avatarUrl={parseAvatarUrl(s.avatarMediaPath)}
      />
      <article className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <nav className="mb-8 text-sm text-stone-600">
          <Link href="/" className="hover:text-stone-900 hover:underline">
            ← Лента
          </Link>
        </nav>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
          Обо мне
        </h1>
        {s.bio ? (
          <p className="mt-4 text-lg text-stone-700">{s.bio}</p>
        ) : null}
        <div className="mt-8 whitespace-pre-wrap text-[1.05rem] leading-relaxed text-stone-800">
          {s.aboutMarkdown || "Текст можно задать в админке → Настройки."}
        </div>
      </article>
      <SiteFooter />
    </>
  );
}
