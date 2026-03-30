import { getSiteSettings } from "@/lib/site";
import { TelegramImportPanel } from "@/components/admin/TelegramImportPanel";
import { DEFAULT_TELEGRAM_CHANNEL } from "@/lib/telegram-default";

export default async function AdminTelegramPage() {
  const s = await getSiteSettings();
  return (
    <TelegramImportPanel
      defaultChannel={s.telegramChannelUser || DEFAULT_TELEGRAM_CHANNEL}
    >
      <h1
        id="telegram-import-title"
        className="text-3xl font-semibold tracking-tight"
      >
        Импорт из Telegram
      </h1>
    </TelegramImportPanel>
  );
}
