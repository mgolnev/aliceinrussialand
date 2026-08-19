import {
  getSiteSettings,
  parseAboutPhotoUrl,
  parseAvatarUrl,
  parseSocialLinks,
} from "@/lib/site";
import { SettingsForm } from "@/components/admin/SettingsForm";

export default async function AdminSettingsPage() {
  const s = await getSiteSettings();
  const social = parseSocialLinks(s.socialLinksJson);

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-stone-200/80 bg-white/90 p-6 ">
        <h1 className="text-3xl font-semibold tracking-tight">Настройки сайта</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                Всё, что влияет на шапку сайта, страницу «Обо мне», аналитику и
          ссылки автора. Меняйте здесь, без ручного редактирования файлов.
        </p>
      </div>
      <SettingsForm
        initial={{
          displayName: s.displayName,
          authorName: s.authorName,
          tagline: s.tagline,
          bio: s.bio,
          aboutMarkdown: s.aboutMarkdown,
          telegramChannelUser: s.telegramChannelUser,
          contactsLabel: s.contactsLabel,
          siteUrl: s.siteUrl,
          seoTitle: s.seoTitle,
          seoDescription: s.seoDescription,
          plausibleDomain: s.plausibleDomain,
          yandexMetrikaId: s.yandexMetrikaId,
          yandexVerification: s.yandexVerification,
          defaultLocale: s.defaultLocale,
          social,
          avatarPreviewUrl: parseAvatarUrl(s.avatarMediaPath),
          aboutPhotoPreviewUrl: parseAboutPhotoUrl(s.aboutPhotoPath),
        }}
      />
    </div>
  );
}
