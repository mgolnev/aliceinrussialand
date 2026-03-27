import { getSiteSettings, parseSocialLinks } from "@/lib/site";
import { SettingsForm } from "@/components/admin/SettingsForm";

export default async function AdminSettingsPage() {
  const s = await getSiteSettings();
  const social = parseSocialLinks(s.socialLinksJson);

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-stone-200/80 bg-white/90 p-6 shadow-[0_20px_50px_-40px_rgba(60,44,29,0.35)]">
        <h1 className="text-3xl font-semibold tracking-tight">Настройки сайта</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                Всё, что влияет на шапку сайта, страницу «Обо мне», аналитику и
          ссылки автора. Меняйте здесь, без ручного редактирования файлов.
        </p>
      </div>
      <SettingsForm
        initial={{
          displayName: s.displayName,
          tagline: s.tagline,
          bio: s.bio,
          aboutMarkdown: s.aboutMarkdown,
          telegramChannelUser: s.telegramChannelUser,
          siteUrl: s.siteUrl,
          plausibleDomain: s.plausibleDomain,
          gaMeasurementId: s.gaMeasurementId,
          defaultLocale: s.defaultLocale,
          social,
        }}
      />
    </div>
  );
}
