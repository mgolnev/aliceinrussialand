import { getSiteSettings } from "@/lib/site";
import { TelegramImportPanel } from "@/components/admin/TelegramImportPanel";
import { DEFAULT_TELEGRAM_CHANNEL } from "@/lib/telegram-default";

export default async function AdminTelegramPage() {
  const s = await getSiteSettings();
  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-stone-200/80 bg-white/90 p-6 shadow-[0_20px_50px_-40px_rgba(60,44,29,0.35)]">
        <h1 className="text-3xl font-semibold tracking-tight">Импорт из Telegram</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
          Парсится публичная витрина{" "}
          <code className="rounded bg-stone-100 px-1.5 py-0.5">t.me/s/…</code> —
          канал
          должен быть открытым. Выберите посты и импортируйте как черновики или
          сразу опубликуйте.
        </p>
      </div>
      <TelegramImportPanel
        defaultChannel={s.telegramChannelUser || DEFAULT_TELEGRAM_CHANNEL}
      />
    </div>
  );
}
