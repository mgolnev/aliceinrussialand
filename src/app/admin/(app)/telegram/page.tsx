import { SocialImportPanel } from "@/components/admin/SocialImportPanel";
import { getSiteSettings } from "@/lib/site";
import { DEFAULT_TELEGRAM_CHANNEL } from "@/lib/telegram-default";

export default async function AdminTelegramPage() {
  const s = await getSiteSettings();
  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-stone-200/80 bg-white/90 p-6 shadow-[0_20px_50px_-40px_rgba(60,44,29,0.35)]">
        <h1 className="text-3xl font-semibold tracking-tight">
          Импорт из соцсетей
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
          Загрузите последние публикации из Telegram, Instagram или Behance,
          отметьте нужные и перенесите их в ленту — как черновики или сразу
          опубликованными.
        </p>
      </div>
      <SocialImportPanel
        defaultTelegramChannel={s.telegramChannelUser || DEFAULT_TELEGRAM_CHANNEL}
      />
    </div>
  );
}
